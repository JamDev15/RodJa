// Downloadable statement and receipt PDFs, and the receipt email.
//
// Both PDFs are built on request from stored data (the statement's frozen
// snapshot; the payment's allocations) and are only served after the same
// access check as the on-screen pages: administrators of the account, or the
// tenant the document belongs to. Nothing is cached in a public place.

import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { buildInvoicePdf, CONTENT_W, INK, LINE, MARGIN, MUTED, PAGE_W, pdfDate, Writer } from "@/lib/pdf";
import { APP_URL, button, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import type { Actor } from "./actor";
import { formatDateOnly, fromDbDate } from "./calendar";
import { notFound } from "./errors";
import { readFileBytes } from "./files";
import { formatCentavos } from "./money";

/** PDF-safe peso text (standard fonts have no ₱ glyph). */
function php(c: number): string {
  return formatCentavos(c).replace("₱", "PHP ");
}

interface StatementSnapshot {
  number?: string;
  property?: { name?: string; address?: string; logoFileId?: string | null };
  tenant?: { name?: string; room?: string };
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;
  lines?: { label?: string; description: string; amountCentavos: number; type?: string }[];
  totals?: {
    previousBalanceCentavos: number;
    currentChargesCentavos: number;
    penaltiesCentavos: number;
    adjustmentsCentavos: number;
    appliedToThisStatementCentavos: number;
    unappliedCreditCentavos: number;
    totalDueCentavos: number;
  };
  paymentInstructions?: string | null;
  issuedAt?: string;
}

async function embedLogo(doc: PDFDocument, fileId: string | null | undefined, accountId: string): Promise<PDFImage | null> {
  if (!fileId) return null;
  const file = await prisma.storedFile.findFirst({ where: { id: fileId, accountId, purpose: "PROPERTY_LOGO" } });
  if (!file) return null;
  const bytes = await readFileBytes(file);
  if (!bytes) return null;
  try {
    if (file.mimeType === "image/png") return await doc.embedPng(bytes);
    if (file.mimeType === "image/jpeg") return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
  return null; // WEBP isn't supported by pdf-lib; the statement still prints without it
}

/** Statement as issued, for admins of the account or the tenant it belongs to. */
export async function statementPdf(actor: Actor | null, statementId: string): Promise<{ bytes: Buffer; fileName: string }> {
  if (!actor || (actor.kind !== "ADMIN" && actor.kind !== "TENANT")) throw notFound("Statement not found");
  const st = await prisma.statement.findFirst({
    where: { id: statementId, accountId: actor.accountId, status: "PUBLISHED", ...(actor.kind === "TENANT" ? { tenantId: actor.tenantId } : {}) },
  });
  if (!st || !st.snapshot) throw notFound("Statement not found");
  return buildStatementPdf(st);
}

/** Render an issued statement. Callers must have checked access already. */
export async function buildStatementPdf(st: { accountId: string; number: string | null; dueDate: Date; snapshot: unknown }): Promise<{ bytes: Buffer; fileName: string }> {
  const snap = st.snapshot as unknown as StatementSnapshot;
  const t = snap.totals;
  const number = snap.number ?? st.number ?? "Statement";
  const propertyName = snap.property?.name ?? "";

  const doc = await PDFDocument.create();
  doc.setTitle(`Statement ${number}`);
  doc.setAuthor(propertyName);
  doc.setCreator("TenantHub (tenant-hub.app)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `${propertyName} · ${number}`);
  const logo = await embedLogo(doc, snap.property?.logoFileId, st.accountId);

  // Header: logo + property on the left, title + numbers on the right.
  const top = w.y;
  let leftX = MARGIN;
  if (logo) {
    const h = 44;
    const scale = h / logo.height;
    const lw = Math.min(logo.width * scale, 120);
    w.page.drawImage(logo, { x: MARGIN, y: top - h, width: lw, height: (lw / logo.width) * logo.height });
    leftX = MARGIN + lw + 12;
  }
  w.page.drawText(w.safe(propertyName), { x: leftX, y: top - 18, size: 14, font: bold, color: INK });
  if (snap.property?.address) w.page.drawText(w.safe(snap.property.address).slice(0, 70), { x: leftX, y: top - 32, size: 9, font, color: MUTED });
  const title = "STATEMENT OF ACCOUNT";
  w.page.drawText(title, { x: PAGE_W - MARGIN - bold.widthOfTextAtSize(title, 13), y: top - 18, size: 13, font: bold, color: rgb(0.15, 0.39, 0.92) });
  const meta = [`No. ${number}`, `Issued: ${snap.issuedAt ? pdfDate(new Date(snap.issuedAt), false, true) : ""}`, `Due: ${snap.dueDate ? formatDateOnly(snap.dueDate) : formatDateOnly(fromDbDate(st.dueDate))}`];
  meta.forEach((l, i) => {
    const s = w.safe(l);
    w.page.drawText(s, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(s, 9.5), y: top - 34 - i * 13, size: 9.5, font, color: INK });
  });
  w.y = top - 34 - meta.length * 13 - 12;
  w.rule(6);

  w.text("BILLED TO", { size: 8.5, bold: true, color: MUTED, gap: 0 });
  w.text(snap.tenant?.name ?? "", { size: 11, bold: true, gap: 0 });
  w.text(`Room ${snap.tenant?.room ?? ""}`, { size: 9.5, color: MUTED, gap: 4 });
  if (snap.periodStart && snap.periodEnd) w.text(`Billing period: ${formatDateOnly(snap.periodStart)} – ${formatDateOnly(snap.periodEnd)}`, { size: 10, gap: 10 });

  // Lines
  const amtX = PAGE_W - MARGIN;
  const row = (label: string, amount: string, opts: { bold?: boolean; muted?: boolean; size?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    const lines = w.wrap(label, size, f, CONTENT_W - 130);
    const h = Math.max(22, lines.length * size * 1.4 + 8);
    w.ensure(h);
    lines.forEach((l, i) => w.page.drawText(l, { x: MARGIN + 8, y: w.y - 15 - i * size * 1.4, size, font: f, color: opts.muted ? MUTED : INK }));
    w.page.drawText(amount, { x: amtX - 8 - f.widthOfTextAtSize(amount, size), y: w.y - 15, size, font: f, color: opts.muted ? MUTED : INK });
    w.y -= h;
    w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 0.5, color: LINE });
  };
  w.ensure(30);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 22, width: CONTENT_W, height: 22, color: rgb(0.95, 0.96, 0.98) });
  w.page.drawText("Description", { x: MARGIN + 8, y: w.y - 15, size: 9, font: bold, color: MUTED });
  w.page.drawText("Amount", { x: amtX - 8 - bold.widthOfTextAtSize("Amount", 9), y: w.y - 15, size: 9, font: bold, color: MUTED });
  w.y -= 22;
  for (const l of snap.lines ?? []) row(l.description, php(l.amountCentavos));
  if (t) {
    row("Current charges", php(t.currentChargesCentavos + t.penaltiesCentavos), { bold: true });
    if (t.adjustmentsCentavos) row("Adjustments (waivers / reductions)", php(t.adjustmentsCentavos), { muted: true });
    if (t.appliedToThisStatementCentavos) row("Payments and credits already applied", php(-t.appliedToThisStatementCentavos), { muted: true });
    row("Previous balance (unpaid from earlier statements)", php(t.previousBalanceCentavos), { muted: true });
    if (t.unappliedCreditCentavos) row("Unapplied credit", php(-t.unappliedCreditCentavos), { muted: true });
    w.ensure(36);
    const total = php(t.totalDueCentavos);
    const label = "Total amount due";
    const tx = amtX - 8 - bold.widthOfTextAtSize(total, 13);
    w.page.drawText(label, { x: tx - 18 - bold.widthOfTextAtSize(label, 11), y: w.y - 22, size: 11, font: bold, color: INK });
    w.page.drawText(total, { x: tx, y: w.y - 22, size: 13, font: bold, color: INK });
    w.y -= 40;
  }

  if (snap.paymentInstructions) {
    w.text("HOW TO PAY", { size: 8.5, bold: true, color: MUTED, gap: 2 });
    w.text(snap.paymentInstructions, { size: 10, gap: 6 });
  }
  w.text("After paying, upload your proof of payment in the tenant portal. Only payments verified by the office reduce your balance.", { size: 9, color: MUTED, gap: 8 });
  w.text(
    "This statement shows the account as of the issue date. Payments, waivers or corrections made later appear in the tenant portal. Generated by TenantHub on behalf of the property owner.",
    { size: 8, color: MUTED },
  );

  return { bytes: Buffer.from(await doc.save()), fileName: `${number}.pdf` };
}

async function receiptInput(paymentId: string, accountId: string, tenantId?: string) {
  const p = await prisma.rentPayment.findFirst({
    where: { id: paymentId, accountId, status: "APPROVED", ...(tenantId ? { tenantId } : {}) },
    include: {
      tenant: { include: { unit: { include: { property: { include: { account: true } } } } } },
      allocations: { where: { reversedAt: null }, include: { charge: { select: { description: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!p || !p.receiptNumber) return null;
  const account = p.tenant.unit.property.account;
  const property = p.tenant.unit.property;
  const profile = await prisma.billingProfile.findUnique({ where: { propertyId: property.id }, select: { paymentInstructions: true } });
  const items = p.allocations.map((a) => ({ label: `Applied to: ${a.charge.description}`, amount: a.amountCentavos / 100 }));
  const applied = p.allocations.reduce((s, a) => s + a.amountCentavos, 0);
  if (p.amountCentavos > applied) items.push({ label: "Kept as credit for future charges", amount: (p.amountCentavos - applied) / 100 });
  return {
    payment: p,
    pdf: {
      type: "receipt" as const,
      number: p.receiptNumber,
      issuedAt: fromDbDateToDate(fromDbDate(p.paidOn)),
      dueDate: null,
      periodLabel: null,
      items,
      total: p.amountCentavos / 100,
      notes: [`Method: ${p.method.toUpperCase()}`, p.referenceNumber ? `Reference: ${p.referenceNumber}` : null].filter(Boolean).join(" · "),
      businessName: property.name,
      ownerName: account.ownerName,
      ownerEmail: account.email,
      ownerPhone: account.phone,
      gcash: null,
      maya: null,
      bankDetails: profile?.paymentInstructions ?? null,
      tenantName: p.tenant.name,
      tenantEmail: p.tenant.email,
      tenantPhone: p.tenant.phone,
      propertyName: property.name,
      unitNumber: p.tenant.unit.unitNumber,
      billToSubtitle: `${property.name}, Room ${p.tenant.unit.unitNumber}`,
    },
    autoSend: account.autoSendReceipts,
  };
}

// Payment dates are date-only; noon UTC renders as the same day in Manila.
function fromDbDateToDate(d: string): Date {
  return new Date(`${d}T04:00:00Z`);
}

/** Receipt for an approved payment, for admins of the account or the tenant who paid. */
export async function receiptPdf(actor: Actor | null, paymentId: string): Promise<{ bytes: Buffer; fileName: string }> {
  if (!actor || (actor.kind !== "ADMIN" && actor.kind !== "TENANT")) throw notFound("Receipt not found");
  const r = await receiptInput(paymentId, actor.accountId, actor.kind === "TENANT" ? actor.tenantId : undefined);
  if (!r) throw notFound("Receipt not found");
  return { bytes: await buildInvoicePdf(r.pdf), fileName: `${r.pdf.number}.pdf` };
}

/**
 * Email the receipt for an approved collections payment (best effort, at most
 * once). Respects the account's "send receipts automatically" setting.
 */
export async function sendReceiptEmail(paymentId: string): Promise<{ sent: boolean; reason?: string }> {
  const base = await prisma.rentPayment.findUnique({ where: { id: paymentId }, select: { accountId: true } });
  if (!base) return { sent: false, reason: "Payment not found" };
  const r = await receiptInput(paymentId, base.accountId);
  if (!r) return { sent: false, reason: "Payment isn't approved" };
  if (!r.autoSend) return { sent: false, reason: "Automatic receipts are turned off" };
  const email = r.payment.tenant.email;
  if (!email) return { sent: false, reason: "Tenant has no email" };
  // Claim the send first so concurrent callers can't email twice.
  const claimed = await prisma.rentPayment.updateMany({ where: { id: paymentId, receiptEmailedAt: null }, data: { receiptEmailedAt: new Date() } });
  if (claimed.count === 0) return { sent: false, reason: "Already sent" };
  const pdf = await buildInvoicePdf(r.pdf);
  const ok = await sendEmail({
    to: email,
    subject: `Receipt ${r.pdf.number} — ${formatCentavos(r.payment.amountCentavos)} received`,
    html: emailLayout(
      `<p>Hi ${escapeHtml(r.payment.tenant.name)},</p>
       <p>We received and verified your payment of <strong>${formatCentavos(r.payment.amountCentavos)}</strong> (paid ${formatDateOnly(fromDbDate(r.payment.paidOn))}) for room ${escapeHtml(r.payment.tenant.unit.unitNumber)}, ${escapeHtml(r.pdf.businessName)}.</p>
       <p>Your receipt <strong>${escapeHtml(r.pdf.number)}</strong> is attached.</p>
       ${button(`${APP_URL}/tenant/billing`, "See your balance")}`,
      `${r.pdf.businessName} · Sent through TenantHub`,
    ),
    attachments: [{ filename: `${r.pdf.number}.pdf`, content: pdf }],
    log: { accountId: r.payment.accountId, tenantId: r.payment.tenantId, recipientType: "tenant", recipientName: r.payment.tenant.name, category: "receipt" },
  });
  if (!ok) await prisma.rentPayment.update({ where: { id: paymentId }, data: { receiptEmailedAt: null } });
  return ok ? { sent: true } : { sent: false, reason: "Email failed" };
}

/** Serve a generated PDF privately. */
export function pdfResponse(bytes: Buffer, fileName: string, download: boolean): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
