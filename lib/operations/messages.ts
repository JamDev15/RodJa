// Private tenant ↔ office conversations.
//
// A thread belongs to one tenancy; only that tenant and the account's
// administrators can read it (caretakers never). Email notifications are
// best effort and throttled so a back-and-forth doesn't flood anyone.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "@/lib/collections/actor";
import { APP_URL, button, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { audit, inTransaction } from "@/lib/collections/db";
import { forbidden, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { actorName, adminTenant, ownTenancy, requireText } from "./common";
import { alertOffice, alertTenant } from "@/lib/messenger";

const NOTIFY_EVERY_MS = 60 * 60 * 1000;

/**
 * Tenant-facing features (messages, household, signed-lease upload,
 * Messenger alerts) are available to every account and property. Kept as
 * one switch point in case they are ever tied to a plan.
 */
export async function tenantFeaturesEnabled(propertyId: string): Promise<boolean> {
  return !!propertyId;
}

async function loadThread(actor: Actor, threadId: string) {
  const thread = await prisma.messageThread.findFirst({ where: { id: threadId, accountId: actor.accountId } });
  if (!thread) throw notFound("Conversation not found");
  if (actor.kind === "TENANT" && thread.tenantId !== actor.tenantId) throw notFound("Conversation not found");
  if (actor.kind !== "TENANT" && actor.kind !== "ADMIN") throw forbidden();
  return thread;
}

async function storeAttachment(actor: Actor, thread: { accountId: string; propertyId: string; tenantId: string }, file: File | null | undefined) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const upload = await readUpload(file);
  const stored = await storeFile({ actor, accountId: thread.accountId, propertyId: thread.propertyId, tenantId: thread.tenantId, purpose: "MESSAGE_ATTACHMENT", file }, upload);
  return stored.id;
}

/** Start a conversation (tenant with the office, or the office with a tenant). */
export async function startThread(actor: Actor, input: { tenantId?: string; subject?: unknown; body?: unknown; file?: File | null }) {
  const tenant = actor.kind === "TENANT" ? await ownTenancy(actor) : await adminTenant(actor, input.tenantId ?? "");
  if (actor.kind === "TENANT" && !(await tenantFeaturesEnabled(tenant.unit.propertyId))) throw forbidden();
  const subject = requireText(input.subject, "Subject", 120);
  const body = requireText(input.body, "Message", 4000);
  const name = await actorName(actor);
  const base = { accountId: tenant.unit.property.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id };
  const attachmentFileId = await storeAttachment(actor, base, input.file);
  const thread = await inTransaction(async (tx) => {
    const now = new Date();
    const t = await tx.messageThread.create({
      data: {
        ...base,
        subject,
        lastMessageAt: now,
        lastSenderRole: actor.kind === "TENANT" ? "TENANT" : "ADMIN",
        ...(actor.kind === "TENANT" ? { tenantReadAt: now } : { adminReadAt: now }),
      },
    });
    await tx.threadMessage.create({ data: { threadId: t.id, senderRole: actor.kind === "TENANT" ? "TENANT" : "ADMIN", senderId: actor.id, senderName: name, body, attachmentFileId } });
    await audit(tx, actor, { entityType: "MessageThread", entityId: t.id, action: "thread_started", propertyId: base.propertyId, tenantId: tenant.id });
    return t;
  });
  await notify(thread.id).catch(() => undefined);
  return thread;
}

export async function reply(actor: Actor, threadId: string, input: { body?: unknown; file?: File | null }) {
  const thread = await loadThread(actor, threadId);
  const body = requireText(input.body, "Message", 4000);
  const attachmentFileId = await storeAttachment(actor, thread, input.file);
  const role = actor.kind === "TENANT" ? "TENANT" : "ADMIN";
  const msg = await inTransaction(async (tx) => {
    const now = new Date();
    const m = await tx.threadMessage.create({ data: { threadId: thread.id, senderRole: role, senderId: actor.id, senderName: await actorName(actor), body, attachmentFileId } });
    await tx.messageThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: now, lastSenderRole: role, status: "OPEN", ...(role === "TENANT" ? { tenantReadAt: now } : { adminReadAt: now }) },
    });
    return m;
  });
  await notify(thread.id).catch(() => undefined);
  return msg;
}

export async function setThreadStatus(actor: Actor, threadId: string, status: unknown) {
  requireAdmin(actor);
  const thread = await loadThread(actor, threadId);
  return prisma.messageThread.update({ where: { id: thread.id }, data: { status: status === "CLOSED" ? "CLOSED" : "OPEN" } });
}

/** Messages of one thread; marks it read for the viewer. */
export async function threadDetail(actor: Actor, threadId: string) {
  const thread = await loadThread(actor, threadId);
  const [messages, tenant] = await Promise.all([
    prisma.threadMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: "asc" } }),
    prisma.tenant.findUnique({ where: { id: thread.tenantId }, select: { id: true, name: true, unit: { select: { unitNumber: true } } } }),
  ]);
  await prisma.messageThread.update({ where: { id: thread.id }, data: actor.kind === "TENANT" ? { tenantReadAt: new Date() } : { adminReadAt: new Date() } });
  return { thread, tenant, messages };
}

export function isUnread(t: { lastMessageAt: Date; lastSenderRole: string | null; adminReadAt: Date | null; tenantReadAt: Date | null }, viewer: "ADMIN" | "TENANT"): boolean {
  if (t.lastSenderRole === viewer) return false;
  const readAt = viewer === "ADMIN" ? t.adminReadAt : t.tenantReadAt;
  return !readAt || readAt < t.lastMessageAt;
}

export async function listThreads(actor: Actor, filter: { propertyId?: string | null } = {}) {
  if (actor.kind === "TENANT") {
    const rows = await prisma.messageThread.findMany({ where: { tenantId: actor.tenantId, accountId: actor.accountId }, orderBy: { lastMessageAt: "desc" } });
    return rows.map((t) => ({ ...t, unread: isUnread(t, "TENANT"), tenantName: null as string | null, room: null as string | null }));
  }
  requireAdmin(actor);
  const rows = await prisma.messageThread.findMany({
    where: { accountId: actor.accountId, ...(filter.propertyId ? { propertyId: filter.propertyId } : {}) },
    include: { tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  return rows.map(({ tenant, ...t }) => ({ ...t, unread: isUnread(t, "ADMIN"), tenantName: tenant.name, room: tenant.unit.unitNumber }));
}

export async function unreadCount(actor: Actor): Promise<number> {
  const rows = await listThreads(actor);
  return rows.filter((r) => r.unread).length;
}

/**
 * Email the other side about a new message: the tenant (if they have an
 * email) when the office writes; the account owner when a tenant writes,
 * at most once an hour per conversation.
 */
async function notify(threadId: string) {
  const t = await prisma.messageThread.findUnique({ where: { id: threadId }, include: { tenant: { include: { unit: { include: { property: { include: { account: true } } } } } } } });
  if (!t) return;
  const account = t.tenant.unit.property.account;
  const propertyName = t.tenant.unit.property.name;
  if (t.lastSenderRole === "ADMIN") {
    const last = await prisma.threadMessage.findFirst({ where: { threadId: t.id }, orderBy: { createdAt: "desc" }, select: { id: true, body: true } });
    await alertTenant(t.tenantId, {
      text: `New message from ${propertyName} (${t.subject}): ${(last?.body ?? "").slice(0, 300)}`,
      path: `/tenant/messages/${t.id}`,
      dedupeKey: last ? `thread-msg:${last.id}` : undefined,
    });
    if (!t.tenant.email) return;
    await sendEmail({
      to: t.tenant.email,
      subject: `New message from ${propertyName}: ${t.subject}`,
      html: emailLayout(`<p>Hi ${escapeHtml(t.tenant.name)},</p><p>The office replied to “${escapeHtml(t.subject)}”.</p>${button(`${APP_URL}/tenant/messages/${t.id}`, "Read the message")}`, `${propertyName} · Sent through TenantHub`),
      log: { accountId: t.accountId, tenantId: t.tenantId, recipientType: "tenant", recipientName: t.tenant.name, category: "system" },
    });
    return;
  }
  const since = new Date(Date.now() - NOTIFY_EVERY_MS);
  const claimed = await prisma.messageThread.updateMany({ where: { id: t.id, OR: [{ ownerNotifiedAt: null }, { ownerNotifiedAt: { lt: since } }] }, data: { ownerNotifiedAt: new Date() } });
  if (claimed.count === 0) return;
  await alertOffice(t.accountId, { text: `${t.tenant.name} (room ${t.tenant.unit.unitNumber}) sent a message: ${t.subject}`, path: `/dashboard/operations/inbox/${t.id}` });
  await sendEmail({
    to: account.email,
    subject: `Message from ${t.tenant.name} (room ${t.tenant.unit.unitNumber}): ${t.subject}`,
    html: emailLayout(`<p>${escapeHtml(t.tenant.name)} (room ${escapeHtml(t.tenant.unit.unitNumber)}, ${escapeHtml(propertyName)}) sent a message: “${escapeHtml(t.subject)}”.</p>${button(`${APP_URL}/dashboard/operations/inbox/${t.id}`, "Open the conversation")}`),
    log: { accountId: t.accountId, recipientType: "owner", recipientName: account.ownerName, category: "system" },
  });
}

/**
 * A tenant replied from Messenger: add it to their most recent open
 * conversation (or start one). Meta may deliver the same message twice, so
 * the Messenger message id is unique. Returns false for a duplicate.
 */
export async function addMessengerReply(tenantId: string, text: string, externalId: string | null): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { unit: { include: { property: true } } } });
  if (!tenant) return false;
  if (externalId && (await prisma.threadMessage.findUnique({ where: { externalId } }))) return false;
  const body = text.slice(0, 4000);
  try {
    const threadId = await inTransaction(async (tx) => {
      const now = new Date();
      const recent = await tx.messageThread.findFirst({ where: { tenantId, status: "OPEN", lastMessageAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }, orderBy: { lastMessageAt: "desc" } });
      const thread =
        recent ??
        (await tx.messageThread.create({
          data: { accountId: tenant.unit.property.accountId, propertyId: tenant.unit.propertyId, tenantId, subject: "Message from Messenger", lastMessageAt: now, lastSenderRole: "TENANT", tenantReadAt: now },
        }));
      await tx.threadMessage.create({ data: { threadId: thread.id, senderRole: "TENANT", senderId: tenantId, senderName: `${tenant.name} (via Messenger)`, body, externalId } });
      await tx.messageThread.update({ where: { id: thread.id }, data: { lastMessageAt: now, lastSenderRole: "TENANT", tenantReadAt: now, status: "OPEN" } });
      return thread.id;
    });
    await notify(threadId).catch(() => undefined);
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}
