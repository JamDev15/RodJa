import { prisma } from "@/lib/prisma";
import type { Account, BillingRecord, Plan } from "@prisma/client";
import { buildInvoicePdf } from "@/lib/pdf";
import type { EmailAttachment } from "@/lib/email";

export type SubscriptionDocType = "invoice" | "receipt";
type RecordWithAccount = BillingRecord & { account: Account & { plan?: Plan } };

const PREFIX: Record<SubscriptionDocType, string> = { invoice: "TH-INV-", receipt: "TH-RCPT-" };
const FIELD = { invoice: "invoiceNumber", receipt: "receiptNumber" } as const;

/** Assigns the platform-wide sequential number the first time a document is issued. */
export async function ensureDocNumber(record: BillingRecord, type: SubscriptionDocType): Promise<string> {
  const field = FIELD[type];
  if (record[field]) return record[field] as string;

  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.billingRecord.count({ where: { [field]: { not: null } } });
    const number = `${PREFIX[type]}${String(count + 1 + attempt).padStart(6, "0")}`;
    try {
      // Only set it if still unset, so two concurrent issues can't renumber.
      const { count: updated } = await prisma.billingRecord.updateMany({
        where: { id: record.id, [field]: null },
        data: { [field]: number },
      });
      const fresh = await prisma.billingRecord.findUniqueOrThrow({ where: { id: record.id } });
      if (updated > 0 || fresh[field]) return fresh[field] as string;
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // number taken — try the next one
    }
  }
  throw new Error("Could not allocate a subscription document number");
}

/** PDF for a TenantHub subscription bill: an invoice before payment, a receipt once paid. */
export async function subscriptionPdf(record: RecordWithAccount, type: SubscriptionDocType): Promise<{ buffer: Buffer; filename: string }> {
  if (type === "receipt" && record.status !== "paid") throw new Error("Receipt is only available once the bill is paid");
  const number = await ensureDocNumber(record, type);
  const settings = await prisma.platformSettings.findFirst();
  const contact = settings?.notificationEmail ?? (process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM ?? "support@tenant-hub.app");
  const plan = record.account.plan ?? (await prisma.plan.findUnique({ where: { id: record.targetPlanId ?? record.account.planId } }));
  const planName = plan?.name ?? "Pro";

  const buffer = await buildInvoicePdf({
    type,
    number,
    issuedAt: type === "receipt" ? record.paidAt ?? new Date() : record.createdAt,
    dueDate: type === "invoice" ? record.dueDate : null,
    periodLabel: record.period,
    items: [{ label: `TenantHub ${planName} subscription — ${record.period}`, amount: record.amount }],
    total: record.amount,
    notes: type === "receipt" && record.referenceNumber ? `Paid via GCash/Maya · Reference no. ${record.referenceNumber}` : null,
    businessName: "TenantHub",
    ownerName: "tenant-hub.app",
    ownerEmail: contact,
    ownerPhone: null,
    gcash: settings?.gcashNumber ?? null,
    maya: settings?.mayaNumber ?? null,
    bankDetails: null,
    tenantName: record.account.ownerName,
    tenantEmail: record.account.email,
    tenantPhone: record.account.phone ?? "",
    billToSubtitle: record.account.name,
    payInstruction: "After paying, submit your reference number in Billing on your TenantHub dashboard.",
    footerNote:
      type === "invoice"
        ? "Subscription billing statement from TenantHub."
        : "Acknowledgement receipt for your TenantHub subscription payment.",
  });
  return { buffer, filename: `${number}.pdf` };
}

/** Convenience for email attachments; returns [] instead of failing the email if the PDF can't be built. */
export async function subscriptionAttachment(recordId: string, type: SubscriptionDocType): Promise<EmailAttachment[]> {
  try {
    const record = await prisma.billingRecord.findUnique({ where: { id: recordId }, include: { account: { include: { plan: true } } } });
    if (!record) return [];
    const { buffer, filename } = await subscriptionPdf(record, type);
    return [{ filename, content: buffer }];
  } catch (err) {
    console.error("Subscription PDF failed:", err);
    return [];
  }
}
