// Settings → Integrations → Connect Facebook Page.
//
// Flow (Facebook Login for TenantHub's single Meta app):
//  1. startConnect: redirect the landlord to Facebook's login dialog with a
//     signed, 30-minute state tied to their account and user.
//  2. handleCallback: exchange the code for a long-lived user token, list
//     the Pages they can message for, and keep that list (tokens encrypted)
//     for 15 minutes so they can pick one.
//  3. choosePage: subscribe our app to the Page's messaging webhooks and
//     save it (one Page per account; a Page can't serve two accounts).
//  4. setupTemplates (optional): create the two utility templates used for
//     alerts outside Meta's 24-hour window; approval arrives by webhook.
//  5. disconnect: unsubscribe the app and forget the Page token.
// The data-deletion callback (Meta requirement for apps using Facebook
// Login) removes everything connected by that Facebook user.

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "@/lib/collections/actor";
import { audit, inTransaction } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { open, seal } from "@/lib/crypto-box";
import { createSignedToken, verifySignedToken } from "@/lib/tokens";
import { graphFetch, metaApp, type MetaAppConfig } from "./index";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");
export const CALLBACK_PATH = "/api/integrations/facebook/callback";
const REQUEST_TTL_MS = 15 * 60 * 1000;

export const TEMPLATE_NAMES = { tenant: "tenanthub_tenant_update", office: "tenanthub_office_update" };

function requireApp(): MetaAppConfig {
  const app = metaApp();
  if (!app) throw invalid("Facebook connection isn't available yet: TenantHub's Meta app settings are missing");
  return app;
}

async function graph<T>(app: MetaAppConfig, path: string, init: RequestInit = {}): Promise<T> {
  const res = await graphFetch(`https://graph.facebook.com/${app.graphVersion}${path}`, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || (data as { error?: unknown }).error) throw invalid(`Facebook said: ${(data as { error?: { message?: string } }).error?.message ?? res.status}`);
  return data;
}

function appSecretProof(app: MetaAppConfig, token: string) {
  return crypto.createHmac("sha256", app.appSecret).update(token).digest("hex");
}

export function startConnect(actor: Actor | null): string {
  requireAdmin(actor);
  const app = requireApp();
  const state = createSignedToken("fbconnect", `${actor.accountId}:${actor.id}`, 1 / 48);
  const q = new URLSearchParams({ client_id: app.appId, redirect_uri: APP_URL + CALLBACK_PATH, state, scope: app.loginScopes, response_type: "code" });
  return `https://www.facebook.com/${app.graphVersion}/dialog/oauth?${q}`;
}

interface FbPage {
  id: string;
  name: string;
  username?: string;
  access_token?: string;
  tasks?: string[];
}

/** Code → long-lived user token → Pages the user can message for. Returns the request id for the picker. */
export async function handleCallback(actor: Actor | null, params: { code?: string | null; state?: string | null; error?: string | null }): Promise<string> {
  requireAdmin(actor);
  const app = requireApp();
  if (params.error) throw invalid("Facebook connection was cancelled");
  const subject = params.state ? verifySignedToken("fbconnect", params.state) : null;
  if (!subject || subject !== `${actor.accountId}:${actor.id}`) throw invalid("This Facebook sign-in link expired or belongs to another session. Start again from Settings → Integrations.");
  if (!params.code) throw invalid("Facebook didn't return a code");
  const short = await graph<{ access_token: string }>(app, `/oauth/access_token?${new URLSearchParams({ client_id: app.appId, client_secret: app.appSecret, redirect_uri: APP_URL + CALLBACK_PATH, code: params.code })}`);
  const long = await graph<{ access_token: string }>(app, `/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: short.access_token })}`);
  const token = long.access_token;
  const proof = appSecretProof(app, token);
  const me = await graph<{ id: string }>(app, `/me?fields=id&access_token=${encodeURIComponent(token)}&appsecret_proof=${proof}`);
  const pages = await graph<{ data: FbPage[] }>(app, `/me/accounts?fields=id,name,username,access_token,tasks&limit=100&access_token=${encodeURIComponent(token)}&appsecret_proof=${proof}`);
  const usable = (pages.data ?? []).filter((p) => p.access_token && (!p.tasks || p.tasks.includes("MESSAGING") || p.tasks.includes("MANAGE")));
  if (!usable.length) throw invalid("No Facebook Pages were shared that you can send messages for. Make sure you're an admin of the Page and tick it when Facebook asks which Pages to share.");
  await prisma.facebookConnectRequest.deleteMany({ where: { OR: [{ accountId: actor.accountId }, { expiresAt: { lt: new Date() } }] } });
  const req = await prisma.facebookConnectRequest.create({
    data: {
      accountId: actor.accountId,
      actorId: actor.id,
      fbUserId: me.id,
      pages: usable.map((p) => ({ id: p.id, name: p.name, username: p.username ?? null, tokenEnc: seal(p.access_token!) })) as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
    },
  });
  return req.id;
}

export async function pendingPages(actor: Actor, requestId: string) {
  requireAdmin(actor);
  const req = await prisma.facebookConnectRequest.findFirst({ where: { id: requestId, accountId: actor.accountId, actorId: actor.id, expiresAt: { gt: new Date() } } });
  if (!req) return null;
  return (req.pages as { id: string; name: string; username: string | null }[]).map(({ id, name, username }) => ({ id, name, username }));
}

export async function choosePage(actor: Actor, requestId: string, pageId: string) {
  requireAdmin(actor);
  const app = requireApp();
  const req = await prisma.facebookConnectRequest.findFirst({ where: { id: requestId, accountId: actor.accountId, actorId: actor.id, expiresAt: { gt: new Date() } } });
  if (!req) throw notFound("That Facebook sign-in expired. Connect again.");
  const page = (req.pages as { id: string; name: string; username: string | null; tokenEnc: string }[]).find((p) => p.id === pageId);
  if (!page) throw notFound("Page not found in your Facebook sign-in");
  const owner = await prisma.messengerPage.findUnique({ where: { pageId } });
  if (owner && owner.accountId !== actor.accountId) throw conflict("This Facebook Page is already connected to another TenantHub account");
  const token = open(page.tokenEnc);
  await graph(app, `/${pageId}/subscribed_apps?${new URLSearchParams({ subscribed_fields: "messages,messaging_postbacks,messaging_referrals", access_token: token, appsecret_proof: appSecretProof(app, token) })}`, { method: "POST" });
  const saved = await inTransaction(async (tx) => {
    const previous = await tx.messengerPage.findUnique({ where: { accountId: actor.accountId } });
    if (previous && previous.pageId !== pageId) {
      // Messenger IDs are per Page: people linked through the old Page must connect again.
      await tx.messengerLink.updateMany({ where: { pageId: previous.pageId, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
    }
    const data = { pageId, pageName: page.name, pageUsername: page.username, pageTokenEnc: page.tokenEnc, connectedByFbUserId: req.fbUserId, connectedBy: actor.id, connectedAt: new Date(), lastError: null, ...(previous?.pageId === pageId ? {} : { tenantTemplateName: null, tenantTemplateStatus: null, officeTemplateName: null, officeTemplateStatus: null }) };
    const row = previous ? await tx.messengerPage.update({ where: { accountId: actor.accountId }, data }) : await tx.messengerPage.create({ data: { ...data, accountId: actor.accountId } });
    await tx.facebookConnectRequest.delete({ where: { id: req.id } });
    await audit(tx, actor, { entityType: "MessengerPage", entityId: row.id, action: "facebook_page_connected", details: { pageId, pageName: page.name } });
    return row;
  });
  return { id: saved.id, pageId: saved.pageId, pageName: saved.pageName };
}

/** Create the two utility templates on the Page (approval is reported by webhook). */
export async function setupTemplates(actor: Actor) {
  requireAdmin(actor);
  const app = requireApp();
  const p = await prisma.messengerPage.findUnique({ where: { accountId: actor.accountId } });
  if (!p) throw notFound("Connect a Facebook Page first");
  const token = open(p.pageTokenEnc);
  const make = async (name: string, text: string, example: string[]) => {
    try {
      const r = await graph<{ id?: string; status?: string }>(app, `/${p.pageId}/message_templates?${new URLSearchParams({ access_token: token, appsecret_proof: appSecretProof(app, token) })}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, language: "en", category: "UTILITY", components: [{ type: "BODY", text, example: { body_text: [example] } }] }),
      });
      return { status: (r.status ?? "PENDING").toUpperCase(), error: null as string | null };
    } catch (err) {
      return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
  };
  const tenant = await make(TEMPLATE_NAMES.tenant, "Hi {{1}}, there's an update on your rental account: {{2}} See the details here: {{3}} Thank you.", ["Ana", "Your statement for November is ready.", `${APP_URL}/tenant/billing`]);
  const office = await make(TEMPLATE_NAMES.office, "Hi {{1}}, {{2}} Open the dashboard: {{3}} Thank you.", ["there", "A tenant sent a payment proof to review.", `${APP_URL}/dashboard`]);
  return prisma.messengerPage.update({
    where: { id: p.id },
    data: { tenantTemplateName: TEMPLATE_NAMES.tenant, tenantTemplateStatus: tenant.status, officeTemplateName: TEMPLATE_NAMES.office, officeTemplateStatus: office.status, lastError: tenant.error ?? office.error },
    select: { tenantTemplateStatus: true, officeTemplateStatus: true, lastError: true },
  });
}

export async function disconnectPage(actor: Actor) {
  requireAdmin(actor);
  const p = await prisma.messengerPage.findUnique({ where: { accountId: actor.accountId } });
  if (!p) return { disconnected: false };
  const app = metaApp();
  if (app) {
    try {
      const token = open(p.pageTokenEnc);
      await graph(app, `/${p.pageId}/subscribed_apps?${new URLSearchParams({ access_token: token, appsecret_proof: appSecretProof(app, token) })}`, { method: "DELETE" });
    } catch (err) {
      console.error("Facebook unsubscribe failed (continuing):", err);
    }
  }
  await inTransaction(async (tx) => {
    await tx.messengerLink.updateMany({ where: { pageId: p.pageId, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
    await tx.messengerPage.delete({ where: { id: p.id } });
    await audit(tx, actor, { entityType: "MessengerPage", entityId: p.id, action: "facebook_page_disconnected", details: { pageId: p.pageId } });
  });
  return { disconnected: true };
}

export async function integrationStatus(actor: Actor) {
  requireAdmin(actor);
  const p = await prisma.messengerPage.findUnique({ where: { accountId: actor.accountId } });
  const [tenantsLinked, officeLinked] = p
    ? await Promise.all([
        prisma.messengerLink.count({ where: { pageId: p.pageId, kind: "TENANT", unlinkedAt: null } }),
        prisma.messengerLink.count({ where: { pageId: p.pageId, kind: "ADMIN", unlinkedAt: null } }),
      ])
    : [0, 0];
  return {
    appReady: !!metaApp(),
    page: p ? { pageId: p.pageId, pageName: p.pageName, pageUsername: p.pageUsername, connectedAt: p.connectedAt.toISOString(), tenantTemplateStatus: p.tenantTemplateStatus, officeTemplateStatus: p.officeTemplateStatus, lastError: p.lastError } : null,
    tenantsLinked,
    officeLinked,
  };
}

/** Meta "signed_request" (data deletion / deauthorize callbacks). */
export function parseSignedRequest(signed: string): { user_id?: string } | null {
  const app = metaApp();
  if (!app) return null;
  const [sig, payload] = signed.split(".");
  if (!sig || !payload) return null;
  const expected = crypto.createHmac("sha256", app.appSecret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Remove Page connections and pending sign-ins made by this Facebook user. */
export async function deleteFacebookUserData(fbUserId: string): Promise<{ confirmationCode: string; pages: number }> {
  const pages = await prisma.messengerPage.findMany({ where: { connectedByFbUserId: fbUserId } });
  for (const p of pages) {
    await prisma.messengerLink.updateMany({ where: { pageId: p.pageId, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
    await prisma.messengerPage.delete({ where: { id: p.id } });
  }
  await prisma.facebookConnectRequest.deleteMany({ where: { fbUserId } });
  const confirmationCode = crypto.createHash("sha256").update(`${fbUserId}:${Date.now()}`).digest("hex").slice(0, 16);
  return { confirmationCode, pages: pages.length };
}
