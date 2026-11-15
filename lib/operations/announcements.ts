// Announcements to one property's tenants, shown on their Notices page and
// optionally emailed. Uses the existing Notice model (tenantId null +
// propertyId), so notices created elsewhere keep working as before.

import { prisma } from "@/lib/prisma";
import { adminProperty, requireAdmin, type Actor } from "@/lib/collections/actor";
import { APP_URL, button, emailLayout, escapeHtml, sendEmail, textToHtml } from "@/lib/email";
import { audit, inTransaction } from "@/lib/collections/db";
import { notFound } from "@/lib/collections/errors";
import { requireText } from "./common";

const TYPES = ["general", "urgent", "maintenance", "payment"] as const;

export async function postAnnouncement(actor: Actor, input: { propertyId?: unknown; title?: unknown; content?: unknown; type?: unknown; email?: unknown }) {
  const property = await adminProperty(actor, String(input.propertyId ?? ""));
  const title = requireText(input.title, "Title", 120);
  const content = requireText(input.content, "Announcement", 4000);
  const type = (TYPES as readonly unknown[]).includes(input.type) ? (input.type as string) : "general";
  const notice = await inTransaction(async (tx) => {
    const n = await tx.notice.create({ data: { accountId: property.accountId, propertyId: property.id, tenantId: null, title, content, type, createdBy: actor.id } });
    await audit(tx, actor, { entityType: "Notice", entityId: n.id, action: "announcement_posted", propertyId: property.id, details: { title, email: input.email === true } });
    return n;
  });
  let emailed = 0;
  if (input.email === true) {
    const tenants = await prisma.tenant.findMany({ where: { isActive: true, unit: { propertyId: property.id }, email: { not: null } }, select: { id: true, name: true, email: true } });
    for (const t of tenants) {
      const ok = await sendEmail({
        to: t.email!,
        subject: `${property.name}: ${title}`,
        html: emailLayout(`<p>Hi ${escapeHtml(t.name)},</p><p><strong>${escapeHtml(title)}</strong></p>${textToHtml(content)}${button(`${APP_URL}/tenant/notices`, "Open the tenant portal")}`, `${property.name} · Sent through TenantHub`),
        log: { accountId: property.accountId, tenantId: t.id, recipientType: "tenant", recipientName: t.name, category: "system" },
      });
      if (ok) emailed++;
    }
  }
  return { notice, emailed };
}

export async function deleteAnnouncement(actor: Actor, noticeId: string) {
  requireAdmin(actor);
  const n = await prisma.notice.findFirst({ where: { id: noticeId, accountId: actor.accountId, tenantId: null, propertyId: { not: null } } });
  if (!n) throw notFound("Announcement not found");
  return inTransaction(async (tx) => {
    await tx.notice.delete({ where: { id: n.id } });
    await audit(tx, actor, { entityType: "Notice", entityId: n.id, action: "announcement_removed", propertyId: n.propertyId, details: { title: n.title } });
  });
}

export async function listAnnouncements(actor: Actor, propertyId: string) {
  requireAdmin(actor);
  return prisma.notice.findMany({ where: { accountId: actor.accountId, propertyId, tenantId: null }, orderBy: { createdAt: "desc" }, take: 50 });
}

/** Notices a tenant sees: their own, account-wide ones, and their property's announcements. */
export function tenantNoticeWhere(accountId: string, tenantId: string, propertyId: string | null) {
  return {
    OR: [{ tenantId }, { accountId, tenantId: null, propertyId: null }, ...(propertyId ? [{ accountId, tenantId: null, propertyId }] : [])],
  };
}
