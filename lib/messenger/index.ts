// Facebook Messenger alerts for tenants and the office — for every account.
//
// Each landlord connects their own Facebook Page in Settings → Integrations
// (lib/messenger/facebook.ts) through TenantHub's single Meta app. This
// module routes everything by that Page:
//  1. A tenant (or office user) taps "Get alerts on Messenger": that opens
//     m.me/<their landlord's Page>?ref=<signed token>. Meta calls our webhook
//     with the ref; we verify it, check it belongs to the Page's account, and
//     link their Messenger ID (PSID) (MessengerLink).
//  2. Alerts go through the Page's Send API: within 24 hours of the person's
//     last message as normal text (Meta's standard window); otherwise only
//     through the Page's approved UTILITY template, if set up; else skipped.
//     Message tags such as ACCOUNT_UPDATE aren't used (removed by Meta on
//     April 27, 2026).
//  3. A linked tenant's replies are added to their conversation in the app.
//
// Best effort throughout: failures are logged (MessageLog, channel
// "messenger") and never affect the action that triggered them. Without the
// META_* app settings, or before a landlord connects a Page, it's simply off.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/crypto-box";
import { logMessage } from "@/lib/message-log";
import { pushOffice, pushTenant } from "@/lib/native-push";
import { createSignedToken, verifySignedToken } from "@/lib/tokens";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  verifyToken: string | null;
  graphVersion: string;
  loginScopes: string;
}

/** TenantHub's Meta app (one for the whole platform). Read at call time. */
export function metaApp(): MetaAppConfig | null {
  const e = process.env;
  if (!e.META_APP_ID || !e.META_APP_SECRET) return null;
  return {
    appId: e.META_APP_ID,
    appSecret: e.META_APP_SECRET,
    verifyToken: e.META_VERIFY_TOKEN ?? null,
    graphVersion: e.META_GRAPH_VERSION || "v25.0",
    loginScopes: e.META_LOGIN_SCOPES || "pages_show_list,pages_messaging,pages_manage_metadata",
  };
}

export interface PageConfig {
  accountId: string;
  pageId: string;
  pageToken: string;
  handle: string;
  tenantTemplate: string | null;
  officeTemplate: string | null;
  templateLanguage: string;
}

function toPageConfig(p: { accountId: string; pageId: string; pageUsername: string | null; pageTokenEnc: string; tenantTemplateName: string | null; tenantTemplateStatus: string | null; officeTemplateName: string | null; officeTemplateStatus: string | null }): PageConfig | null {
  try {
    return {
      accountId: p.accountId,
      pageId: p.pageId,
      pageToken: open(p.pageTokenEnc),
      handle: p.pageUsername || p.pageId,
      tenantTemplate: p.tenantTemplateStatus === "APPROVED" ? p.tenantTemplateName : null,
      officeTemplate: p.officeTemplateStatus === "APPROVED" ? p.officeTemplateName : null,
      templateLanguage: "en",
    };
  } catch (err) {
    console.error("Messenger: page token unreadable (encryption key changed?)", err);
    return null;
  }
}

export async function pageForAccount(accountId: string): Promise<PageConfig | null> {
  if (!metaApp()) return null;
  const p = await prisma.messengerPage.findUnique({ where: { accountId } });
  return p ? toPageConfig(p) : null;
}

async function pageById(pageId: string): Promise<PageConfig | null> {
  const p = await prisma.messengerPage.findUnique({ where: { pageId } });
  return p ? toPageConfig(p) : null;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: FetchLike = (url, init) => fetch(url, init);
/** Tests replace Graph API calls. */
export function setMessengerFetchForTests(f: FetchLike | null) {
  fetcher = f ?? ((url, init) => fetch(url, init));
}
export function graphFetch(url: string, init: RequestInit = {}) {
  return fetcher(url, init);
}

// ─── Linking ────────────────────────────────────────────────────────────────

export type LinkSubject = { kind: "TENANT"; tenantId: string } | { kind: "ADMIN"; accountId: string; userId: string };

function subjectString(s: LinkSubject): string {
  return s.kind === "TENANT" ? `t:${s.tenantId}` : `a:${s.accountId}:${s.userId}`;
}

function parseSubject(v: string): LinkSubject | null {
  const parts = v.split(":");
  if (parts[0] === "t" && parts.length === 2 && parts[1]) return { kind: "TENANT", tenantId: parts[1] };
  if (parts[0] === "a" && parts.length === 3 && parts[1] && parts[2]) return { kind: "ADMIN", accountId: parts[1], userId: parts[2] };
  return null;
}

/** m.me link to the account's Page that connects this person (valid 7 days). Null when not set up. */
export async function connectUrl(subject: LinkSubject, accountId: string): Promise<string | null> {
  const page = await pageForAccount(accountId);
  if (!page) return null;
  const ref = createSignedToken("messenger", subjectString(subject), 7);
  return `https://m.me/${encodeURIComponent(page.handle)}?ref=${encodeURIComponent(ref)}`;
}

export async function linkStatus(subject: LinkSubject, accountId: string): Promise<{ available: boolean; linked: boolean }> {
  const page = await pageForAccount(accountId);
  if (!page) return { available: false, linked: false };
  const where = subject.kind === "TENANT" ? { tenantId: subject.tenantId } : { accountId: subject.accountId, userId: subject.userId };
  const n = await prisma.messengerLink.count({ where: { ...where, kind: subject.kind, pageId: page.pageId, unlinkedAt: null } });
  return { available: true, linked: n > 0 };
}

export async function unlink(subject: LinkSubject): Promise<number> {
  const where = subject.kind === "TENANT" ? { tenantId: subject.tenantId } : { accountId: subject.accountId, userId: subject.userId };
  const r = await prisma.messengerLink.updateMany({ where: { ...where, kind: subject.kind, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
  return r.count;
}

/** Verify a ref from the webhook; it must belong to the account that owns this Page. */
async function linkFromRef(page: PageConfig, psid: string, ref: string): Promise<{ ok: boolean; name?: string; kind?: string }> {
  const raw = verifySignedToken("messenger", ref);
  const subject = raw ? parseSubject(raw) : null;
  if (!subject) return { ok: false };
  let accountId: string;
  let name: string;
  if (subject.kind === "TENANT") {
    const t = await prisma.tenant.findUnique({ where: { id: subject.tenantId }, select: { name: true, isActive: true, unit: { select: { property: { select: { accountId: true } } } } } });
    if (!t || !t.isActive) return { ok: false };
    accountId = t.unit.property.accountId;
    name = t.name;
  } else {
    const isOwner = subject.userId === subject.accountId;
    const found = isOwner
      ? await prisma.account.findUnique({ where: { id: subject.accountId }, select: { ownerName: true } })
      : await prisma.user.findFirst({ where: { id: subject.userId, accountId: subject.accountId, role: { not: "CARETAKER" } }, select: { name: true } });
    if (!found) return { ok: false };
    accountId = subject.accountId;
    name = "ownerName" in found ? found.ownerName : found.name;
  }
  // A link for one landlord's tenant can't be used on another landlord's Page.
  if (accountId !== page.accountId) return { ok: false };
  const data = {
    accountId,
    kind: subject.kind,
    tenantId: subject.kind === "TENANT" ? subject.tenantId : null,
    userId: subject.kind === "ADMIN" ? subject.userId : null,
    linkedAt: new Date(),
    lastInboundAt: new Date(),
    unlinkedAt: null,
  };
  await prisma.messengerLink.upsert({ where: { pageId_psid: { pageId: page.pageId, psid } }, create: { ...data, pageId: page.pageId, psid }, update: data });
  return { ok: true, name, kind: subject.kind };
}

// ─── Sending ────────────────────────────────────────────────────────────────

async function graphSend(page: PageConfig, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const app = metaApp();
  if (!app) return { ok: false, error: "Meta app not configured" };
  try {
    const res = await fetcher(`https://graph.facebook.com/${app.graphVersion}/${page.pageId}/messages?access_token=${encodeURIComponent(page.pageToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Template parameters may not contain #, $ or % and must not be empty. */
function templateParam(v: string): string {
  const s = v.replace(/[#$%{}\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
  return (s || "-").slice(0, 200);
}

export interface Alert {
  /** One line, no links (the link is appended). */
  text: string;
  /** Path in the app, e.g. /tenant/messages/abc. */
  path: string;
  /** An alert with the same key is never sent twice to the same person. */
  dedupeKey?: string;
  category?: "system" | "reminder" | "receipt" | "invoice";
}

type LinkRow = { id: string; psid: string; accountId: string; tenantId: string | null; lastInboundAt: Date | null; kind: string };

async function deliver(page: PageConfig, link: LinkRow, recipientName: string, alert: Alert): Promise<"sent" | "skipped" | "failed"> {
  const subject = alert.dedupeKey ? `${alert.dedupeKey}:${link.id}` : null;
  if (subject && (await prisma.messageLog.count({ where: { channel: "messenger", subject, status: "sent" } }))) return "skipped";
  const url = `${APP_URL}${alert.path}`;
  const inWindow = !!link.lastInboundAt && Date.now() - link.lastInboundAt.getTime() < WINDOW_MS;
  const template = link.kind === "TENANT" ? page.tenantTemplate : page.officeTemplate;
  const base = { accountId: link.accountId, tenantId: link.tenantId, recipientType: link.kind === "TENANT" ? ("tenant" as const) : ("owner" as const), recipientName, channel: "messenger" as const, to: link.psid, subject: subject ?? undefined, body: alert.text, category: alert.category ?? "system" };
  let body: Record<string, unknown>;
  if (inWindow) {
    body = { recipient: { id: link.psid }, messaging_type: "UPDATE", message: { text: `${alert.text}\n${url}`.slice(0, 1900) } };
  } else if (template) {
    body = {
      recipient: { id: link.psid },
      messaging_type: "UTILITY",
      message: { template: { name: template, language: { code: page.templateLanguage }, components: [{ type: "body", parameters: [recipientName, alert.text, url].map((t) => ({ type: "text", text: templateParam(t) })) }] } },
    };
  } else {
    await logMessage({ ...base, status: "failed", error: "Outside Meta's 24-hour window and no approved utility template" });
    return "skipped";
  }
  const r = await graphSend(page, body);
  await logMessage({ ...base, status: r.ok ? "sent" : "failed", error: r.error });
  return r.ok ? "sent" : "failed";
}

/**
 * Alert a tenant: phone-app push (if they installed the app) and Messenger
 * (if their landlord connected a Page and they turned it on).
 */
export async function alertTenant(tenantId: string, alert: Alert): Promise<number> {
  await pushTenant(tenantId, { title: "TenantHub", body: alert.text, path: alert.path, dedupeKey: alert.dedupeKey }).catch((err) => console.error("Push failed:", err));
  try {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, unit: { select: { property: { select: { accountId: true } } } } } });
    if (!t) return 0;
    const page = await pageForAccount(t.unit.property.accountId);
    if (!page) return 0;
    const links = await prisma.messengerLink.findMany({ where: { tenantId, kind: "TENANT", pageId: page.pageId, unlinkedAt: null } });
    let sent = 0;
    for (const l of links) if ((await deliver(page, l, t.name, alert)) === "sent") sent++;
    return sent;
  } catch (err) {
    console.error("Messenger alert failed:", err);
    return 0;
  }
}

/** Alert the office: phone-app push and Messenger, for users who turned them on. */
export async function alertOffice(accountId: string, alert: Alert): Promise<number> {
  await pushOffice(accountId, { title: "TenantHub", body: alert.text, path: alert.path, dedupeKey: alert.dedupeKey }).catch((err) => console.error("Push failed:", err));
  try {
    const page = await pageForAccount(accountId);
    if (!page) return 0;
    const links = await prisma.messengerLink.findMany({ where: { accountId, kind: "ADMIN", pageId: page.pageId, unlinkedAt: null } });
    let sent = 0;
    for (const l of links) if ((await deliver(page, l, "there", alert)) === "sent") sent++;
    return sent;
  } catch (err) {
    console.error("Messenger alert failed:", err);
    return 0;
  }
}

// ─── Webhook ────────────────────────────────────────────────────────────────

/** X-Hub-Signature-256 check over the raw request body, with the app secret. */
export function validSignature(rawBody: string, header: string | null): boolean {
  const app = metaApp();
  if (!app || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", app.appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyChallenge(params: URLSearchParams): string | null {
  const app = metaApp();
  if (!app?.verifyToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  const a = Buffer.from(params.get("hub.verify_token") ?? "");
  const b = Buffer.from(app.verifyToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return params.get("hub.challenge");
}

interface MessagingEvent {
  sender?: { id?: string };
  referral?: { ref?: string };
  postback?: { referral?: { ref?: string } };
  message?: { text?: string; is_echo?: boolean; mid?: string };
}

interface ChangeEvent {
  field?: string;
  value?: { event?: string; message_template_name?: string; reason?: string };
}

async function reply(page: PageConfig, psid: string, text: string) {
  await graphSend(page, { recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } });
}

/** Handle one verified webhook payload. Returns what happened, for logs/tests. */
export async function handleWebhook(payload: unknown): Promise<string[]> {
  const out: string[] = [];
  if (!metaApp()) return out;
  const body = payload as { object?: string; entry?: { id?: string; messaging?: MessagingEvent[]; changes?: ChangeEvent[] }[] };
  if (body.object !== "page") return out;
  for (const entry of body.entry ?? []) {
    if (!entry.id) continue;
    const page = await pageById(entry.id);
    if (!page) {
      out.push("unknown_page");
      continue;
    }
    for (const ch of entry.changes ?? []) {
      if (ch.field === "message_template_status_update" && ch.value?.message_template_name) {
        const status = (ch.value.event ?? "").toUpperCase();
        const name = ch.value.message_template_name;
        await prisma.messengerPage.updateMany({ where: { pageId: page.pageId, tenantTemplateName: name }, data: { tenantTemplateStatus: status } });
        await prisma.messengerPage.updateMany({ where: { pageId: page.pageId, officeTemplateName: name }, data: { officeTemplateStatus: status } });
        out.push(`template_${status.toLowerCase()}`);
      }
    }
    for (const ev of entry.messaging ?? []) {
      const psid = ev.sender?.id;
      if (!psid || psid === page.pageId || ev.message?.is_echo) continue;
      const ref = ev.referral?.ref ?? ev.postback?.referral?.ref;
      if (ref) {
        const r = await linkFromRef(page, psid, ref);
        if (r.ok) {
          await reply(
            page,
            psid,
            r.kind === "TENANT"
              ? `Hi ${r.name}! You're connected. You'll get alerts here about messages from the office, statements and payments. You can also reply here to message the office. Send STOP to turn alerts off.`
              : `You're connected. You'll get alerts here when tenants write, send payments or report repairs. Send STOP to turn alerts off.`,
          );
          out.push("linked");
        } else {
          await reply(page, psid, "This connect link has expired or isn't valid. Open the app again and tap “Get alerts on Messenger”.");
          out.push("bad_ref");
        }
        continue;
      }
      if (!ev.message) continue;
      const link = await prisma.messengerLink.findUnique({ where: { pageId_psid: { pageId: page.pageId, psid } } });
      if (!link || link.unlinkedAt) {
        await reply(page, psid, "To get alerts here, sign in to your tenant portal and tap “Get alerts on Messenger”.");
        out.push("unknown_sender");
        continue;
      }
      await prisma.messengerLink.update({ where: { id: link.id }, data: { lastInboundAt: new Date() } });
      const text = (ev.message.text ?? "").trim();
      if (/^(stop|unsubscribe)$/i.test(text)) {
        await prisma.messengerLink.update({ where: { id: link.id }, data: { unlinkedAt: new Date() } });
        await reply(page, psid, "Alerts are off. You can turn them on again from the app.");
        out.push("stopped");
        continue;
      }
      if (link.kind === "TENANT" && link.tenantId && text) {
        const { addMessengerReply } = await import("@/lib/operations/messages");
        const added = await addMessengerReply(link.tenantId, text, ev.message.mid ?? null);
        if (added) await reply(page, psid, "Sent to the office. You'll get their reply here and in your tenant portal.");
        out.push(added ? "tenant_message" : "tenant_message_duplicate");
        continue;
      }
      if (link.kind === "ADMIN") {
        await reply(page, psid, "Replies to tenants are sent from the dashboard Inbox.");
        out.push("admin_message");
      }
    }
  }
  return out;
}
