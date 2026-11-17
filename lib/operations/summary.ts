// Property operations overview: occupancy, leases ending, maintenance,
// upcoming move-ins / move-outs, unread messages. Read-only.

import { prisma } from "@/lib/prisma";
import { adminProperty, type Actor } from "@/lib/collections/actor";
import { addDays, fromDbDate, toDbDate } from "@/lib/collections/calendar";
import { APP_URL, button, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { today, toDateOnly } from "./common";
import { expiringLeases } from "./leases";
import { accountScope, listRequests, OPEN_RAW } from "./maintenance";
import { listThreads } from "./messages";

export async function operationsSummary(actor: Actor, propertyId: string) {
  await adminProperty(actor, propertyId);
  const day = today();
  const in30 = addDays(day, 30);
  const [units, openRequests, leases, moveOuts, upcomingMoveIns, threads, recentMoveIns] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId }, select: { id: true, unitNumber: true, status: true, tenants: { where: { isActive: true }, select: { id: true } } }, orderBy: { unitNumber: "asc" } }),
    listRequests(actor, { propertyId, status: "open" }),
    expiringLeases(actor.accountId, propertyId, 60),
    prisma.moveOut.findMany({ where: { propertyId, status: "IN_PROGRESS" }, include: { tenant: { select: { id: true, name: true, unit: { select: { unitNumber: true } } } } }, orderBy: { plannedDate: "asc" } }),
    prisma.tenant.findMany({ where: { unit: { propertyId }, moveInDate: { gt: toDbDate(day), lte: toDbDate(in30) } }, select: { id: true, name: true, moveInDate: true, unit: { select: { unitNumber: true } } }, orderBy: { moveInDate: "asc" } }),
    listThreads(actor, { propertyId }),
    prisma.tenant.findMany({
      where: { isActive: true, unit: { propertyId }, moveInDate: { gte: toDbDate(addDays(day, -60)) } },
      select: { id: true, name: true, moveInDate: true, unit: { select: { unitNumber: true } }, checklists: { where: { kind: "MOVE_IN" }, select: { status: true } } },
      orderBy: { moveInDate: "desc" },
    }),
  ]);
  const occupied = units.filter((u) => u.tenants.length > 0).length;
  const byStatus: Record<string, number> = {};
  for (const r of openRequests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    occupancy: { rooms: units.length, occupied, vacant: units.length - occupied, rate: units.length ? Math.round((occupied / units.length) * 100) : 0, vacantRooms: units.filter((u) => u.tenants.length === 0).map((u) => u.unitNumber) },
    maintenance: { open: openRequests.length, urgent: openRequests.filter((r) => r.priority === "urgent" || r.priority === "high").length, unassigned: openRequests.filter((r) => !r.assignee).length, byStatus, top: openRequests.slice(0, 5) },
    leases: leases.map((l) => ({ id: l.id, tenantId: l.tenant.id, tenantName: l.tenant.name, room: l.tenant.unit.unitNumber, endDate: fromDbDate(l.endDate!) })),
    moveOuts: moveOuts.map((m) => ({ id: m.id, tenantId: m.tenant.id, tenantName: m.tenant.name, room: m.tenant.unit.unitNumber, plannedDate: fromDbDate(m.plannedDate) })),
    moveIns: upcomingMoveIns.map((t) => ({ tenantId: t.id, tenantName: t.name, room: t.unit.unitNumber, date: toDateOnly(t.moveInDate) })),
    moveInChecklistsOpen: recentMoveIns.filter((t) => t.checklists[0]?.status !== "COMPLETED").map((t) => ({ tenantId: t.id, tenantName: t.name, room: t.unit.unitNumber, started: t.checklists.length > 0 })),
    messages: { unread: threads.filter((t) => t.unread).length, open: threads.filter((t) => t.status === "OPEN").length },
  };
}

/** Account-wide counts for the main dashboard / sidebar badge. */
export async function accountOperationCounts(accountId: string) {
  const [openMaintenance, threads] = await Promise.all([
    prisma.maintenanceRequest.count({ where: { AND: [accountScope(accountId), { status: { in: OPEN_RAW } }] } }),
    prisma.messageThread.findMany({ where: { accountId, lastSenderRole: "TENANT" }, select: { lastMessageAt: true, adminReadAt: true } }),
  ]);
  return { openMaintenance, unreadMessages: threads.filter((t) => !t.adminReadAt || t.adminReadAt < t.lastMessageAt).length };
}

/**
 * Daily: one email to the owner per lease term, 30 days before it ends
 * (only for active tenancies and unrenewed terms).
 */
export async function sendLeaseExpiryNotices(): Promise<number> {
  const day = today();
  const terms = await prisma.leaseTerm.findMany({
    where: { expiryNoticeSentAt: null, endDate: { gte: toDbDate(day), lte: toDbDate(addDays(day, 30)) }, tenant: { isActive: true } },
    include: { tenant: { include: { unit: { include: { property: { include: { account: true } } } } } } },
  });
  let sent = 0;
  for (const t of terms) {
    const renewed = await prisma.leaseTerm.findUnique({ where: { renewalOfId: t.id }, select: { id: true } });
    if (renewed) continue;
    const claimed = await prisma.leaseTerm.updateMany({ where: { id: t.id, expiryNoticeSentAt: null }, data: { expiryNoticeSentAt: new Date() } });
    if (!claimed.count) continue;
    const acc = t.tenant.unit.property.account;
    const ok = await sendEmail({
      to: acc.email,
      subject: `Lease ending ${fromDbDate(t.endDate!)}: ${t.tenant.name}, room ${t.tenant.unit.unitNumber}`,
      html: emailLayout(`<p>The lease for <strong>${escapeHtml(t.tenant.name)}</strong> (room ${escapeHtml(t.tenant.unit.unitNumber)}, ${escapeHtml(t.tenant.unit.property.name)}) ends on ${fromDbDate(t.endDate!)}.</p><p>Renew it or start the move-out from the tenancy page.</p>${button(`${APP_URL}/dashboard/operations/tenancies/${t.tenantId}`, "Open the tenancy")}`),
      log: { accountId: acc.id, tenantId: t.tenantId, recipientType: "owner", recipientName: acc.ownerName, category: "reminder" },
    });
    if (!ok) await prisma.leaseTerm.update({ where: { id: t.id }, data: { expiryNoticeSentAt: null } });
    else sent++;
  }
  return sent;
}

