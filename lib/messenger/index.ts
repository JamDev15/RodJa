// Facebook Messenger alerts for tenants and the office.
//
// How it works
//  1. A tenant (or office user) taps "Get alerts on Messenger". That opens
//     m.me/<page>?ref=<signed token> in Messenger. When they press Get
//     Started / send a message, Meta calls our webhook with the ref; we
//     verify the token and link their Messenger ID (PSID) to the tenancy
//     or office user (MessengerLink).
//  2. Alerts are sent through the Page's Send API:
//     - within 24 hours of the person's last message to the Page, as a
//       normal text message (Meta's standard messaging window);
//     - otherwise only through a pre-approved UTILITY template, if one is
//       configured (MESSENGER_TEMPLATE_TENANT / _OFFICE); else skipped.
//     Message tags such as ACCOUNT_UPDATE are not used: Meta removed them
//     on April 27, 2026.
//  3. A linked tenant's text replies are added to their conversation with
//     the office (the same thread the portal shows).
//
// Everything is best effort: Messenger failures are logged (MessageLog,
// channel "messenger") and never affect the action that triggered them.
// Without the MESSENGER_* settings the feature is simply off.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logMessage } from "@/lib/message-log";
import { createSignedToken, verifySignedToken } from "@/lib/tokens";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MessengerConfig {
  pageId: string;
  pageToken: string;
  appSecret: string;
  verifyToken: string | null;
  pageHandle: string;
  graphVersion: string;
  tenantTemplate: string | null;
  officeTemplate: string | null;
  templateLanguage: string;
}

/** Read at call time so tests (and a restart with new settings) pick up changes. */
export function messengerConfig(): MessengerConfig | null {
  const e = process.env;
  if (!e.MESSENGER_PAGE_ID || !e.MESSENGER_PAGE_ACCESS_TOKEN || !e.MESSENGER_APP_SECRET) return null;
  return {
    pageId: e.MESSENGER_PAGE_ID,
    pageToken: e.MESSENGER_PAGE_ACCESS_TOKEN,
    appSecret: e.MESSENGER_APP_SECRET,
    verifyToken: e.MESSENGER_VERIFY_TOKEN ?? null,
    pageHandle: e.MESSENGER_PAGE_USERNAME || e.MESSENGER_PAGE_ID,
    graphVersion: e.MESSENGER_GRAPH_VERSION || "v25.0",
    tenantTemplate: e.MESSENGER_TEMPLATE_TENANT || null,
    officeTemplate: e.MESSENGER_TEMPLATE_OFFICE || null,
    templateLanguage: e.MESSENGER_TEMPLATE_LANGUAGE || "en",
  };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: FetchLike = (url, init) => fetch(url, init);
/** Tests replace the Graph API call. */
export function setMessengerFetchForTests(f: FetchLike | null) {
  fetcher = f ?? ((url, init) => fetch(url, init));
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

/** m.me link that connects this person when opened (valid 7 days). Null when Messenger isn't set up. */
export function connectUrl(subject: LinkSubject): string | null {
  const cfg = messengerConfig();
  if (!cfg) return null;
  const ref = createSignedToken("messenger", subjectString(subject), 7);
  return `https://m.me/${encodeURIComponent(cfg.pageHandle)}?ref=${encodeURIComponent(ref)}`;
}

export async function linkStatus(subject: LinkSubject): Promise<{ available: boolean; linked: boolean }> {
  const cfg = messengerConfig();
  if (!cfg) return { available: false, linked: false };
  const where = subject.kind === "TENANT" ? { tenantId: subject.tenantId } : { accountId: subject.accountId, userId: subject.userId };
  const n = await prisma.messengerLink.count({ where: { ...where, kind: subject.kind, pageId: cfg.pageId, unlinkedAt: null } });
  return { available: true, linked: n > 0 };
}

export async function unlink(subject: LinkSubject): Promise<number> {
  const where = subject.kind === "TENANT" ? { tenantId: subject.tenantId } : { accountId: subject.accountId, userId: subject.userId };
  const r = await prisma.messengerLink.updateMany({ where: { ...where, kind: subject.kind, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
  return r.count;
}

/** Verify a ref from the webhook and attach this Messenger person to the tenancy / office user. */
async function linkFromRef(cfg: MessengerConfig, psid: string, ref: string): Promise<{ ok: boolean; name?: string; kind?: string }> {
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
    const ok = isOwner
      ? await prisma.account.findUnique({ where: { id: subject.accountId }, select: { ownerName: true } })
      : await prisma.user.findFirst({ where: { id: subject.userId, accountId: subject.accountId, role: { not: "CARETAKER" } }, select: { name: true } });
    if (!ok) return { ok: false };
    accountId = subject.accountId;
    name = "ownerName" in ok ? ok.ownerName : ok.name;
  }
  const data = {
    accountId,
    kind: subject.kind,
    tenantId: subject.kind === "TENANT" ? subject.tenantId : null,
    userId: subject.kind === "ADMIN" ? subject.userId : null,
    linkedAt: new Date(),
    lastInboundAt: new Date(),
    unlinkedAt: null,
  };
  await prisma.messengerLink.upsert({ where: { pageId_psid: { pageId: cfg.pageId, psid } }, create: { ...data, pageId: cfg.pageId, psid }, update: data });
  return { ok: true, name, kind: subject.kind };
}

// ─── Sending ────────────────────────────────────────────────────────────────

async function graphSend(cfg: MessengerConfig, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetcher(`https://graph.facebook.com/${cfg.graphVersion}/${cfg.pageId}/messages?access_token=${encodeURIComponent(cfg.pageToken)}`, {
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
  /** Recorded in MessageLog; an alert with the same key is never sent twice to the same person. */
  dedupeKey?: string;
  category?: "system" | "reminder" | "receipt" | "invoice";
}

type LinkRow = { id: string; psid: string; accountId: string; tenantId: string | null; lastInboundAt: Date | null; kind: string };

async function deliver(cfg: MessengerConfig, link: LinkRow, recipientName: string, alert: Alert): Promise<"sent" | "skipped" | "failed"> {
  const subject = alert.dedupeKey ? `${alert.dedupeKey}:${link.id}` : null;
  if (subject && (await prisma.messageLog.count({ where: { channel: "messenger", subject, status: "sent" } }))) return "skipped";
  const url = `${APP_URL}${alert.path}`;
  const inWindow = !!link.lastInboundAt && Date.now() - link.lastInboundAt.getTime() < WINDOW_MS;
  const template = link.kind === "TENANT" ? cfg.tenantTemplate : cfg.officeTemplate;
  let body: Record<string, unknown>;
  if (inWindow) {
    body = { recipient: { id: link.psid }, messaging_type: "UPDATE", message: { text: `${alert.text}\n${url}`.slice(0, 1900) } };
  } else if (template) {
    // Utility template, e.g.: "Hi {{1}}, {{2}} Open {{3}} to see the details."
    body = {
      recipient: { id: link.psid },
      messaging_type: "UTILITY",
      message: { template: { name: template, language: { code: cfg.templateLanguage }, components: [{ type: "body", parameters: [recipientName, alert.text, url].map((t) => ({ type: "text", text: templateParam(t) })) }] } },
    };
  } else {
    await logMessage({ accountId: link.accountId, tenantId: link.tenantId, recipientType: link.kind === "TENANT" ? "tenant" : "owner", recipientName, channel: "messenger", to: link.psid, subject: subject ?? undefined, body: alert.text, category: alert.category ?? "system", status: "failed", error: "Outside Meta's 24-hour window and no utility template is configured" });
    return "skipped";
  }
  const r = await graphSend(cfg, body);
  await logMessage({ accountId: link.accountId, tenantId: link.tenantId, recipientType: link.kind === "TENANT" ? "tenant" : "owner", recipientName, channel: "messenger", to: link.psid, subject: subject ?? undefined, body: alert.text, category: alert.category ?? "system", status: r.ok ? "sent" : "failed", error: r.error });
  return r.ok ? "sent" : "failed";
}

/** Alert every Messenger account linked to this tenancy. */
export async function alertTenant(tenantId: string, alert: Alert): Promise<number> {
  const cfg = messengerConfig();
  if (!cfg) return 0;
  try {
    const links = await prisma.messengerLink.findMany({ where: { tenantId, kind: "TENANT", pageId: cfg.pageId, unlinkedAt: null } });
    if (!links.length) return 0;
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    let sent = 0;
    for (const l of links) if ((await deliver(cfg, l, t?.name ?? "there", alert)) === "sent") sent++;
    return sent;
  } catch (err) {
    console.error("Messenger alert failed:", err);
    return 0;
  }
}

/** Alert the office users of an account who connected Messenger. */
export async function alertOffice(accountId: string, alert: Alert): Promise<number> {
  const cfg = messengerConfig();
  if (!cfg) return 0;
  try {
    const links = await prisma.messengerLink.findMany({ where: { accountId, kind: "ADMIN", pageId: cfg.pageId, unlinkedAt: null } });
    let sent = 0;
    for (const l of links) if ((await deliver(cfg, l, "there", alert)) === "sent") sent++;
    return sent;
  } catch (err) {
    console.error("Messenger alert failed:", err);
    return 0;
  }
}

// ─── Webhook ────────────────────────────────────────────────────────────────

/** X-Hub-Signature-256 check over the raw request body. */
export function validSignature(rawBody: string, header: string | null): boolean {
  const cfg = messengerConfig();
  if (!cfg || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", cfg.appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyChallenge(params: URLSearchParams): string | null {
  const cfg = messengerConfig();
  if (!cfg?.verifyToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(cfg.verifyToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return params.get("hub.challenge");
}

interface MessagingEvent {
  sender?: { id?: string };
  referral?: { ref?: string };
  postback?: { referral?: { ref?: string } };
  message?: { text?: string; is_echo?: boolean; mid?: string };
}

async function reply(cfg: MessengerConfig, psid: string, text: string) {
  await graphSend(cfg, { recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } });
}

/** Handle one verified webhook payload. Returns what happened, for logs/tests. */
export async function handleWebhook(payload: unknown): Promise<string[]> {
  const cfg = messengerConfig();
  const out: string[] = [];
  if (!cfg) return out;
  const body = payload as { object?: string; entry?: { id?: string; messaging?: MessagingEvent[] }[] };
  if (body.object !== "page") return out;
  for (const entry of body.entry ?? []) {
    if (entry.id && entry.id !== cfg.pageId) continue;
    for (const ev of entry.messaging ?? []) {
      const psid = ev.sender?.id;
      if (!psid || psid === cfg.pageId || ev.message?.is_echo) continue;
      const ref = ev.referral?.ref ?? ev.postback?.referral?.ref;
      if (ref) {
        const r = await linkFromRef(cfg, psid, ref);
        if (r.ok) {
          await reply(
            cfg,
            psid,
            r.kind === "TENANT"
              ? `Hi ${r.name}! You're connected. You'll get alerts here about messages from the office, statements and payments. You can also reply here to message the office. Send STOP to turn alerts off.`
              : `You're connected. You'll get alerts here when tenants write, send payments or report repairs. Send STOP to turn alerts off.`,
          );
          out.push("linked");
        } else {
          await reply(cfg, psid, "This connect link has expired or isn't valid. Open the app again and tap “Get alerts on Messenger”.");
          out.push("bad_ref");
        }
        continue;
      }
      if (!ev.message) continue;
      const link = await prisma.messengerLink.findUnique({ where: { pageId_psid: { pageId: cfg.pageId, psid } } });
      if (!link || link.unlinkedAt) {
        await reply(cfg, psid, "To get alerts here, sign in to your tenant portal and tap “Get alerts on Messenger”.");
        out.push("unknown_sender");
        continue;
      }
      await prisma.messengerLink.update({ where: { id: link.id }, data: { lastInboundAt: new Date() } });
      const text = (ev.message.text ?? "").trim();
      if (/^(stop|unsubscribe)$/i.test(text)) {
        await prisma.messengerLink.update({ where: { id: link.id }, data: { unlinkedAt: new Date() } });
        await reply(cfg, psid, "Alerts are off. You can turn them on again from the app.");
        out.push("stopped");
        continue;
      }
      if (link.kind === "TENANT" && link.tenantId && text) {
        const { addMessengerReply } = await import("@/lib/operations/messages");
        const added = await addMessengerReply(link.tenantId, text, ev.message.mid ?? null);
        if (added) await reply(cfg, psid, "Sent to the office. You'll get their reply here and in your tenant portal.");
        out.push(added ? "tenant_message" : "tenant_message_duplicate");
        continue;
      }
      if (link.kind === "ADMIN") {
        await reply(cfg, psid, "Replies to tenants are sent from the dashboard Inbox.");
        out.push("admin_message");
      }
    }
  }
  return out;
}
