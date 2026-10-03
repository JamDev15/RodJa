import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Account, Invoice, MonthlyLedger, Payment, Property, Tenant, Unit } from "@prisma/client";
import { buildInvoicePdf } from "@/lib/pdf";
import { APP_URL, sendInvoiceEmail } from "@/lib/email";
import { logMessage } from "@/lib/message-log";
import { dueDateForMonth } from "@/lib/due-dates";
import { getMonthLabel } from "@/lib/utils";

export type InvoiceItem = { label: string; amount: number };
type TenantFull = Tenant & { unit: Unit & { property: Property } };

const BILLS = [
  { key: "rent", label: "Rent" },
  { key: "electric", label: "Electricity" },
  { key: "water", label: "Water" },
  { key: "other", label: "Other" },
] as const;

function bill(ledger: MonthlyLedger, key: (typeof BILLS)[number]["key"]) {
  const billed = (ledger as any)[`${key}Amount`] as number | null;
  const paidAmt = (ledger as any)[`${key}PaidAmount`] as number | null;
  const paid = (ledger as any)[`${key}Paid`] as boolean;
  const label = key === "other" ? ledger.otherLabel || "Other charges" : BILLS.find((b) => b.key === key)!.label;
  const balance = !billed ? 0 : paidAmt != null ? Math.max(0, billed - paidAmt) : paid ? 0 : billed;
  const settled = !!billed && balance === 0;
  return { billed: billed ?? 0, paidAmt, label, balance, settled };
}

/** What's still owed on a ledger month, line by line. */
export function invoiceItemsFromLedger(ledger: MonthlyLedger): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  for (const { key } of BILLS) {
    const b = bill(ledger, key);
    if (b.balance > 0) items.push({ label: b.paidAmt ? `${b.label} (balance)` : b.label, amount: b.balance });
  }
  if (ledger.balance > 0 && !ledger.balancePaid) items.push({ label: "Previous unpaid balance", amount: ledger.balance });
  return items;
}

/** Everything that's been paid on a ledger month, line by line. */
export function receiptItemsFromLedger(ledger: MonthlyLedger): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  for (const { key } of BILLS) {
    const b = bill(ledger, key);
    const paid = b.paidAmt != null ? Math.min(b.paidAmt, b.billed) : b.settled ? b.billed : 0;
    if (paid > 0) items.push({ label: b.label, amount: paid });
  }
  if (ledger.balance > 0 && ledger.balancePaid) items.push({ label: "Previous balance", amount: ledger.balance });
  return items;
}

/**
 * Bills that went from unpaid to settled between two snapshots of the same
 * ledger month — exactly what a "mark paid" just covered, so the automatic
 * receipt lists only that, not everything paid earlier in the month.
 */
export function newlySettledItems(before: MonthlyLedger | null, after: MonthlyLedger): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  for (const { key } of BILLS) {
    const was = before ? bill(before, key).settled : false;
    const now = bill(after, key);
    if (!was && now.settled) items.push({ label: now.label, amount: now.paidAmt != null ? Math.min(now.paidAmt, now.billed) : now.billed });
  }
  const balanceWas = before ? before.balancePaid : false;
  if (!balanceWas && after.balancePaid && after.balance > 0) items.push({ label: "Previous balance", amount: after.balance });
  return items;
}

export function receiptItemsFromPayment(p: Payment): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  if (p.rentAmount) items.push({ label: "Rent", amount: p.rentAmount });
  if (p.electricAmount) items.push({ label: "Electricity", amount: p.electricAmount });
  if (p.waterAmount) items.push({ label: "Water", amount: p.waterAmount });
  const itemized = items.reduce((s, i) => s + i.amount, 0);
  if (items.length === 0 || Math.abs(itemized - p.amount) > 0.009) {
    // Breakdown missing or doesn't add up: show the payment as one line.
    return [{ label: `Payment for ${getMonthLabel(p.month)}`, amount: p.amount }];
  }
  return items;
}

async function nextNumber(accountId: string, type: "invoice" | "receipt"): Promise<string> {
  const prefix = type === "invoice" ? "INV" : "RCPT";
  const count = await prisma.invoice.count({ where: { accountId, type } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export function docUrl(token: string): string {
  return `${APP_URL}/docs/${token}`;
}

export async function invoicePdf(inv: Invoice, account: Account, tenant: TenantFull): Promise<Buffer> {
  return buildInvoicePdf({
    type: inv.type as "invoice" | "receipt",
    number: inv.number,
    issuedAt: inv.createdAt,
    dueDate: inv.dueDate,
    periodLabel: inv.month ? getMonthLabel(inv.month) : null,
    items: (inv.items as InvoiceItem[]) ?? [],
    total: inv.total,
    notes: inv.notes,
    businessName: account.name,
    ownerName: account.ownerName,
    ownerEmail: account.email,
    ownerPhone: account.phone,
    gcash: account.gcashNumber,
    maya: account.mayaNumber,
    bankDetails: account.bankDetails,
    tenantName: tenant.name,
    tenantEmail: tenant.email,
    tenantPhone: tenant.phone,
    propertyName: tenant.unit.property.name,
    unitNumber: tenant.unit.unitNumber,
  });
}

export interface IssueOptions {
  account: Account;
  tenant: TenantFull;
  type: "invoice" | "receipt";
  items: InvoiceItem[];
  month: string | null;
  ledgerId?: string | null;
  paymentId?: string | null;
  notes?: string | null;
}

/**
 * Creates the invoice/receipt record (sequential number per account), emails
 * the tenant the PDF plus a view link, and posts it to their portal.
 */
export async function issueDocument(opts: IssueOptions): Promise<{ invoice: Invoice; emailed: boolean }> {
  const total = Math.round(opts.items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const dueDate = opts.type === "invoice" && opts.month ? dueDateForMonth(opts.month, opts.tenant.dueDay) : null;

  let invoice: Invoice | null = null;
  for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
    try {
      invoice = await prisma.invoice.create({
        data: {
          accountId: opts.account.id,
          tenantId: opts.tenant.id,
          ledgerId: opts.ledgerId ?? null,
          paymentId: opts.paymentId ?? null,
          type: opts.type,
          number: await nextNumber(opts.account.id, opts.type),
          month: opts.month,
          items: opts.items,
          total,
          dueDate,
          notes: opts.notes ?? null,
          token: crypto.randomBytes(24).toString("base64url"),
        },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // number taken by a concurrent issue — retry
    }
  }
  if (!invoice) throw new Error("Could not allocate an invoice number");

  const log = {
    accountId: opts.account.id,
    tenantId: opts.tenant.id,
    recipientType: "tenant" as const,
    recipientName: opts.tenant.name,
    category: opts.type,
  };
  const label = opts.type === "invoice" ? "Invoice" : "Receipt";

  let emailed = false;
  if (opts.tenant.email) {
    const pdf = await invoicePdf(invoice, opts.account, opts.tenant);
    emailed = await sendInvoiceEmail({
      to: opts.tenant.email,
      tenantName: opts.tenant.name,
      ownerName: opts.account.ownerName,
      kind: opts.type,
      number: invoice.number,
      total,
      periodLabel: opts.month ? getMonthLabel(opts.month) : null,
      dueDate,
      viewUrl: docUrl(invoice.token),
      pdf,
      gcash: opts.account.gcashNumber,
      maya: opts.account.mayaNumber,
      log,
    });
    if (emailed) invoice = await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } });
  }

  const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(total);
  const title = `${label} ${invoice.number} – ${money}`;
  await prisma.notice.create({
    data: {
      tenantId: opts.tenant.id,
      accountId: opts.account.id,
      title,
      content: opts.type === "invoice" ? "A new bill is ready. Open Documents to view or download it." : "Payment received — thank you! Your receipt is in Documents.",
      type: opts.type,
    },
  });
  await logMessage({ ...log, channel: "in_app", to: "Tenant portal", subject: title, body: (opts.items.map((i) => `${i.label}: ${i.amount}`).join("\n")), status: "sent" });

  return { invoice, emailed };
}

/** Auto-receipt hook for ledger "mark paid" edits; no-op if nothing newly settled or the owner turned it off. */
export async function autoReceiptForLedgerChange(before: MonthlyLedger | null, after: MonthlyLedger): Promise<void> {
  try {
    const items = newlySettledItems(before, after);
    if (items.length === 0) return;
    const tenant = await prisma.tenant.findUnique({
      where: { id: after.tenantId },
      include: { unit: { include: { property: { include: { account: true } } } } },
    });
    if (!tenant) return;
    const account = tenant.unit.property.account;
    if (!account.autoSendReceipts) return;
    await issueDocument({ account, tenant, type: "receipt", items, month: after.month, ledgerId: after.id });
  } catch (err) {
    console.error("Auto-receipt failed:", err);
  }
}
