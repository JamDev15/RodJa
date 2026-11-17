// Statement distribution and VECO receipt reminders, through the existing
// email channel (Resend) and Message History. No paid SMS required.

import { prisma } from "@/lib/prisma";
import { APP_URL, button, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { requireAdmin, type Actor } from "./actor";
import { formatDateOnly, formatMonth, fromDbDate } from "./calendar";
import { notFound } from "./errors";
import { formatCentavos } from "./money";
import { buildStatementPdf } from "./documents";
import { alertTenant } from "@/lib/messenger";

export async function sendStatementEmail(statementId: string): Promise<{ sent: boolean; reason?: string }> {
  const st = await prisma.statement.findUnique({ where: { id: statementId }, include: { tenant: { include: { unit: { include: { property: true } } } } } });
  if (!st || st.status !== "PUBLISHED") return { sent: false, reason: "Statement isn't issued" };
  // Messenger alert (if connected), at most once per statement, with or without email.
  await alertTenant(st.tenantId, {
    text: `Your statement ${st.number ?? ""} from ${st.tenant.unit.property.name} is ready: ${formatCentavos(st.totalDueCentavos ?? 0).replace("₱", "PHP ")} due ${formatDateOnly(fromDbDate(st.dueDate))}.`,
    path: `/tenant/billing/statements/${st.id}`,
    dedupeKey: `statement:${st.id}`,
    category: "invoice",
  });
  const email = st.tenant.email;
  if (!email) {
    await prisma.statement.update({ where: { id: st.id }, data: { sendError: "Tenant has no email — visible in the tenant portal" } });
    return { sent: false, reason: "Tenant has no email" };
  }
  const snap = (st.snapshot ?? {}) as { lines?: { description: string; amountCentavos: number }[]; totals?: { previousBalanceCentavos: number; totalDueCentavos: number } };
  const rows = (snap.lines ?? [])
    .map((l) => `<tr><td style="padding:4px 0">${escapeHtml(l.description)}</td><td style="padding:4px 0;text-align:right">${formatCentavos(l.amountCentavos)}</td></tr>`)
    .join("");
  const html = emailLayout(`
    <p>Hi ${escapeHtml(st.tenant.name)},</p>
    <p>Your statement <strong>${escapeHtml(st.number ?? "")}</strong> for room ${escapeHtml(st.tenant.unit.unitNumber)} at ${escapeHtml(st.tenant.unit.property.name)} is ready.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
      <tr><td style="padding:4px 0">Previous balance</td><td style="padding:4px 0;text-align:right">${formatCentavos(snap.totals?.previousBalanceCentavos ?? 0)}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb"><strong>Total due by ${formatDateOnly(fromDbDate(st.dueDate))}</strong></td><td style="padding:8px 0;border-top:1px solid #e5e7eb;text-align:right"><strong>${formatCentavos(st.totalDueCentavos ?? 0)}</strong></td></tr>
    </table>
    <p style="margin-top:16px">Sign in to the tenant portal to see the full statement and upload your payment proof.</p>
    ${button(`${APP_URL}/tenant/billing/statements/${st.id}`, "View statement")}
  `, `${st.tenant.unit.property.name} · Sent through TenantHub`);
  const pdf = await buildStatementPdf(st).catch((err) => {
    console.error("Statement PDF failed; sending without attachment:", err);
    return null;
  });
  const ok = await sendEmail({
    to: email,
    attachments: pdf ? [{ filename: pdf.fileName, content: pdf.bytes }] : undefined,
    subject: `Statement ${st.number} — ${formatCentavos(st.totalDueCentavos ?? 0)} due ${formatDateOnly(fromDbDate(st.dueDate))}`,
    html,
    log: { accountId: st.accountId, tenantId: st.tenantId, recipientType: "tenant", recipientName: st.tenant.name, category: "invoice" },
  });
  await prisma.statement.update({ where: { id: st.id }, data: ok ? { sentAt: new Date(), sendError: null } : { sendError: "Email failed — will retry" } });
  return ok ? { sent: true } : { sent: false, reason: "Email failed" };
}

export async function sendStatementNow(actor: Actor, statementId: string) {
  requireAdmin(actor);
  const st = await prisma.statement.findFirst({ where: { id: statementId, accountId: actor.accountId } });
  if (!st) throw notFound("Statement not found");
  return sendStatementEmail(st.id);
}

export async function sendVecoReminder(tenant: { tenantId: string; tenantName: string; email: string | null; unitNumber: string; months: string[] }, accountId: string, propertyName: string) {
  if (!tenant.email) return false;
  const month = tenant.months[tenant.months.length - 1];
  const already = await prisma.vecoReminderLog.findUnique({ where: { tenantId_billingMonth_channel: { tenantId: tenant.tenantId, billingMonth: month, channel: "email" } } });
  if (already) return false;
  const ok = await sendEmail({
    to: tenant.email,
    subject: `Please upload your VECO receipt for ${formatMonth(month)}`,
    html: emailLayout(`
      <p>Hi ${escapeHtml(tenant.tenantName)},</p>
      <p>We don't have your VECO electricity receipt for ${tenant.months.map(formatMonth).map(escapeHtml).join(", ")} (room ${escapeHtml(tenant.unitNumber)}, ${escapeHtml(propertyName)}).</p>
      <p>Please upload a photo of the receipt in the tenant portal.</p>
      ${button(`${APP_URL}/tenant/billing#veco`, "Upload receipt")}
    `),
    log: { accountId, tenantId: tenant.tenantId, recipientType: "tenant", recipientName: tenant.tenantName, category: "reminder" },
  });
  if (ok) {
    await prisma.vecoReminderLog.create({ data: { tenantId: tenant.tenantId, billingMonth: month, channel: "email" } }).catch(() => undefined);
  }
  return ok;
}
