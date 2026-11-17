// Messenger alerts for billing and maintenance events. Called by the API
// routes after the action has succeeded; each is best effort and sent at
// most once per event (dedupe key).

import { prisma } from "@/lib/prisma";
import { formatCentavos } from "@/lib/collections/money";
import { alertOffice, alertTenant } from "./index";

const php = (c: number) => formatCentavos(c).replace("₱", "PHP ");

export async function paymentReviewed(paymentId: string): Promise<void> {
  const p = await prisma.rentPayment.findUnique({ where: { id: paymentId }, select: { id: true, tenantId: true, status: true, amountCentavos: true, rejectedReason: true } });
  if (!p) return;
  if (p.status === "APPROVED") {
    await alertTenant(p.tenantId, { text: `Your payment of ${php(p.amountCentavos)} was verified. Thank you!`, path: "/tenant/billing", dedupeKey: `payment-approved:${p.id}`, category: "receipt" });
  } else if (p.status === "REJECTED") {
    await alertTenant(p.tenantId, { text: `Your payment of ${php(p.amountCentavos)} was not accepted: ${(p.rejectedReason ?? "").slice(0, 200)}`, path: "/tenant/billing", dedupeKey: `payment-rejected:${p.id}` });
  }
}

export async function paymentSubmitted(paymentId: string): Promise<void> {
  const p = await prisma.rentPayment.findUnique({ where: { id: paymentId }, select: { id: true, accountId: true, propertyId: true, amountCentavos: true, status: true, tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } } });
  if (!p || p.status !== "PENDING") return;
  await alertOffice(p.accountId, { text: `${p.tenant.name} (room ${p.tenant.unit.unitNumber}) sent a payment proof for ${php(p.amountCentavos)} to review.`, path: `/dashboard/collections?propertyId=${p.propertyId}`, dedupeKey: `payment-submitted:${p.id}` });
}

export async function maintenanceSubmitted(requestId: string): Promise<void> {
  const r = await prisma.maintenanceRequest.findUnique({ where: { id: requestId }, select: { id: true, accountId: true, title: true, priority: true, tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } } });
  if (!r?.accountId) return;
  const who = r.tenant ? `${r.tenant.name} (room ${r.tenant.unit.unitNumber})` : "A tenant";
  await alertOffice(r.accountId, { text: `${who} reported a repair${r.priority === "urgent" || r.priority === "high" ? ` (${r.priority})` : ""}: ${r.title}`, path: `/dashboard/operations/maintenance/${r.id}`, dedupeKey: `maintenance:${r.id}` });
}

export async function announcementPosted(noticeId: string): Promise<number> {
  const n = await prisma.notice.findUnique({ where: { id: noticeId }, select: { id: true, title: true, propertyId: true } });
  if (!n?.propertyId) return 0;
  const linked = await prisma.messengerLink.findMany({ where: { kind: "TENANT", unlinkedAt: null }, select: { tenantId: true }, distinct: ["tenantId"] });
  const tenants = await prisma.tenant.findMany({ where: { isActive: true, unit: { propertyId: n.propertyId }, id: { in: linked.map((l) => l.tenantId!).filter(Boolean) } }, select: { id: true } });
  let sent = 0;
  for (const t of tenants) sent += await alertTenant(t.id, { text: `Announcement: ${n.title}`, path: "/tenant/notices", dedupeKey: `notice:${n.id}` });
  return sent;
}
