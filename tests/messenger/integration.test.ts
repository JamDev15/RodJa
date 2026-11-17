// Messenger alerts and the per-account Facebook Page connection.
// The Graph API is replaced by a recorder; no real Facebook calls are made.
//
//   TEST_DATABASE_URL=postgresql://... npm run test:integration

import { before, after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("messenger integration tests skipped (set TEST_DATABASE_URL)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  process.env.AUTH_SECRET ??= "test-secret-for-signed-tokens";
  delete process.env.RESEND_API_KEY;
  run();
}

function run() {
  type Actor = import("@/lib/collections/actor").Actor;
  let m: {
    prisma: typeof import("@/lib/prisma").prisma;
    profile: typeof import("@/lib/collections/profile");
    messenger: typeof import("@/lib/messenger");
    facebook: typeof import("@/lib/messenger/facebook");
    messages: typeof import("@/lib/operations/messages");
    tokens: typeof import("@/lib/tokens");
    box: typeof import("@/lib/crypto-box");
  };
  const tag = `m${Date.now().toString(36)}`;
  const PAGE = `page-${tag}`;
  const OTHER_PAGE = `page2-${tag}`;
  let accountId: string, otherAccountId: string, tenantId: string, otherTenantId: string, otherAccountTenantId: string, caretakerId: string;
  let admin: Actor, otherAdmin: Actor;
  let sent: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
  let failNext = false;
  let graphReplies: Record<string, unknown> = {};

  const env = { META_APP_ID: "app-123", META_APP_SECRET: "app-secret", META_VERIFY_TOKEN: "verify-me" };
  const on = () => Object.assign(process.env, env);
  const off = () => Object.keys(env).forEach((k) => delete process.env[k]);
  const refOf = (u: string) => decodeURIComponent(new URL(u).searchParams.get("ref")!);
  const postback = (psid: string, ref: string, page = PAGE) => ({ object: "page", entry: [{ id: page, messaging: [{ sender: { id: psid }, postback: { referral: { ref } } }] }] });
  const text = (psid: string, t: string, mid: string = crypto.randomUUID()) => ({ object: "page", entry: [{ id: PAGE, messaging: [{ sender: { id: psid }, message: { mid, text: t } }] }] });
  const sends = () => sent.filter((s) => s.url.includes("/messages?"));
  const texts = () => sends().map((s) => ((s.body?.message as { text?: string }) ?? {}).text ?? "");
  const conn = (s: Parameters<typeof m.messenger.connectUrl>[0], acct = accountId) => m.messenger.connectUrl(s, acct).then((u) => u!);

  before(async () => {
    m = {
      prisma: (await import("@/lib/prisma")).prisma,
      profile: await import("@/lib/collections/profile"),
      messenger: await import("@/lib/messenger"),
      facebook: await import("@/lib/messenger/facebook"),
      messages: await import("@/lib/operations/messages"),
      tokens: await import("@/lib/tokens"),
      box: await import("@/lib/crypto-box"),
    };
    m.messenger.setMessengerFetchForTests(async (u, init) => {
      sent.push({ url: u, method: String(init.method ?? "GET"), body: init.body ? JSON.parse(String(init.body)) : null });
      if (failNext) {
        failNext = false;
        return new Response('{"error":{"code":10,"message":"denied"}}', { status: 400 });
      }
      const key = Object.keys(graphReplies).find((k) => u.includes(k));
      return new Response(JSON.stringify(key ? graphReplies[key] : { message_id: "m1", success: true }), { status: 200 });
    });
    const plan = await m.prisma.plan.create({ data: { name: `Msgr ${tag}`, price: 499, maxUnits: 100, maxTenants: 100, maxProperties: 10, features: [] } });
    const acct = await m.prisma.account.create({ data: { name: `Dawson msgr ${tag}`, ownerName: "Byron Test", email: `msgr.${tag}@example.test`, password: "x", planId: plan.id } });
    const other = await m.prisma.account.create({ data: { name: `Other msgr ${tag}`, ownerName: "Other Owner", email: `msgr2.${tag}@example.test`, password: "x", planId: plan.id } });
    accountId = acct.id;
    otherAccountId = other.id;
    admin = { kind: "ADMIN", id: accountId, role: "LANDLORD", accountId };
    otherAdmin = { kind: "ADMIN", id: otherAccountId, role: "LANDLORD", accountId: otherAccountId };
    const propertyId = (await m.prisma.property.create({ data: { accountId, name: "Dawson (messenger test)", address: "Cebu", type: "apartment" } })).id;
    const otherPropertyId = (await m.prisma.property.create({ data: { accountId: otherAccountId, name: "Other (messenger test)", address: "Manila", type: "apartment" } })).id;
    const unit = await m.prisma.unit.create({ data: { propertyId, unitNumber: "401", rentAmount: 5000, status: "occupied" } });
    const unit2 = await m.prisma.unit.create({ data: { propertyId, unitNumber: "402", rentAmount: 5000, status: "occupied" } });
    const unit3 = await m.prisma.unit.create({ data: { propertyId: otherPropertyId, unitNumber: "1", rentAmount: 5000, status: "occupied" } });
    tenantId = (await m.prisma.tenant.create({ data: { unitId: unit.id, name: "Ana Test", phone: `+63917${tag}a`.slice(0, 30), moveInDate: new Date("2026-10-01T00:00:00+08:00"), portalPin: "x" } })).id;
    otherTenantId = (await m.prisma.tenant.create({ data: { unitId: unit2.id, name: "Ben Test", phone: `+63917${tag}b`.slice(0, 30), moveInDate: new Date("2026-10-01T00:00:00+08:00"), portalPin: "x", isActive: false } })).id;
    otherAccountTenantId = (await m.prisma.tenant.create({ data: { unitId: unit3.id, name: "Cara Other", phone: `+63917${tag}c`.slice(0, 30), moveInDate: new Date("2026-10-01T00:00:00+08:00"), portalPin: "x" } })).id;
    caretakerId = (await m.prisma.user.create({ data: { accountId, email: `msgr-care.${tag}@example.test`, password: "x", name: "Care", role: "CARETAKER" } })).id;
    // Both landlords have connected their own Page (the connect flow itself is tested below).
    await m.prisma.messengerPage.create({ data: { accountId, pageId: PAGE, pageName: "Dawson Residences", pageUsername: "DawsonResidences", pageTokenEnc: m.box.seal("page-token-1"), connectedBy: accountId } });
    await m.prisma.messengerPage.create({ data: { accountId: otherAccountId, pageId: OTHER_PAGE, pageName: "Other Apartments", pageTokenEnc: m.box.seal("page-token-2"), connectedBy: otherAccountId } });
  });

  beforeEach(() => {
    sent = [];
    graphReplies = {};
  });

  after(async () => {
    off();
    m?.messenger.setMessengerFetchForTests(null);
    await m?.prisma.$disconnect();
  });

  describe("Messenger alerts", () => {
    test("off without TenantHub's Meta app settings: no connect link, alerts are no-ops", async () => {
      off();
      assert.equal(await m.messenger.connectUrl({ kind: "TENANT", tenantId }, accountId), null);
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.deepEqual(await m.messenger.handleWebhook(postback("p1", "x")), []);
      assert.equal(sent.length, 0);
    });

    test("page tokens are stored encrypted", async () => {
      const row = await m.prisma.messengerPage.findUniqueOrThrow({ where: { pageId: PAGE } });
      assert.ok(!row.pageTokenEnc.includes("page-token-1"));
      assert.equal(m.box.open(row.pageTokenEnc), "page-token-1");
    });

    test("webhook checks: signature over the raw body and the subscription verify token", () => {
      on();
      const raw = JSON.stringify({ object: "page" });
      const good = "sha256=" + crypto.createHmac("sha256", "app-secret").update(raw).digest("hex");
      assert.equal(m.messenger.validSignature(raw, good), true);
      assert.equal(m.messenger.validSignature(raw + " ", good), false);
      assert.equal(m.messenger.validSignature(raw, null), false);
      assert.equal(m.messenger.verifyChallenge(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42" })), "42");
      assert.equal(m.messenger.verifyChallenge(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42" })), null);
    });

    test("tenants connect to their own landlord's Page only; tampered, expired, moved-out and caretaker refs are refused", async () => {
      on();
      const link = await conn({ kind: "TENANT", tenantId });
      assert.match(link, /^https:\/\/m\.me\/DawsonResidences\?ref=/);
      const ref = refOf(link);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", ref.slice(0, -2) + "xx")), ["bad_ref"]);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", m.tokens.createSignedToken("messenger", `t:${tenantId}`, -1))), ["bad_ref"]);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", refOf(await conn({ kind: "TENANT", tenantId: otherTenantId })))), ["bad_ref"]);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", refOf(await conn({ kind: "ADMIN", accountId, userId: caretakerId })))), ["bad_ref"]);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", ref, OTHER_PAGE)), ["bad_ref"], "a Dawson tenant can't attach to another landlord's Page");
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", "x", "unknown-page")), ["unknown_page"]);
      assert.equal(await m.prisma.messengerLink.count({ where: { pageId: { in: [PAGE, OTHER_PAGE] } } }), 0);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-ana", ref)), ["linked"]);
      assert.match(texts().at(-1)!, /You're connected/);
      assert.ok(sends().at(-1)!.url.includes(`/${PAGE}/messages?access_token=page-token-1`), "sent with the landlord's own Page token");
      assert.deepEqual(await m.messenger.linkStatus({ kind: "TENANT", tenantId }, accountId), { available: true, linked: true });
    });

    test("inside 24 hours a plain text alert goes; the same event is never sent twice", async () => {
      on();
      const alert = { text: "Your statement is ready", path: "/tenant/billing", dedupeKey: `st:${tag}` };
      assert.equal(await m.messenger.alertTenant(tenantId, alert), 1);
      assert.equal(await m.messenger.alertTenant(tenantId, alert), 0);
      assert.equal(sends().length, 1);
      assert.equal(sends()[0].body!.messaging_type, "UPDATE");
      assert.match(texts()[0], /Your statement is ready\nhttps?:\/\/.+\/tenant\/billing$/);
    });

    test("outside 24 hours: skipped until the Page's template is approved; then sent as a cleaned utility template", async () => {
      on();
      await m.prisma.messengerLink.updateMany({ where: { tenantId }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) } });
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.equal(sends().length, 0);
      await m.prisma.messengerPage.update({ where: { pageId: PAGE }, data: { tenantTemplateName: "tenanthub_tenant_update", tenantTemplateStatus: "PENDING" } });
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0, "pending templates aren't used");
      // Meta reports approval by webhook
      assert.deepEqual(await m.messenger.handleWebhook({ object: "page", entry: [{ id: PAGE, changes: [{ field: "message_template_status_update", value: { event: "APPROVED", message_template_name: "tenanthub_tenant_update" } }] }] }), ["template_approved"]);
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "Payment of PHP 2,000.00 #1 was 100% verified $", path: "/tenant/billing" }), 1);
      const msg = sends()[0].body as { messaging_type: string; message: { template: { name: string; components: { parameters: { text: string }[] }[] } } };
      assert.equal(msg.messaging_type, "UTILITY");
      assert.equal(msg.message.template.name, "tenanthub_tenant_update");
      const params = msg.message.template.components[0].parameters.map((p) => p.text);
      assert.equal(params[0], "Ana Test");
      assert.ok(params.every((p) => !/[#$%]/.test(p)), "Meta rejects #, $ and % in parameters");
    });

    test("a Graph API failure is logged and never throws", async () => {
      on();
      await m.prisma.messengerLink.updateMany({ where: { tenantId }, data: { lastInboundAt: new Date() } });
      failNext = true;
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      const log = await m.prisma.messageLog.findFirst({ where: { tenantId, channel: "messenger", status: "failed" }, orderBy: { createdAt: "desc" } });
      assert.match(log!.error!, /^400/);
    });

    test("tenant replies in Messenger land in their conversation once, and alert the office", async () => {
      on();
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-owner", refOf(await conn({ kind: "ADMIN", accountId, userId: accountId })))), ["linked"]);
      sent = [];
      const ev = text("psid-ana", "Can I pay on the 16th?", `mid.${tag}`);
      assert.deepEqual(await m.messenger.handleWebhook(ev), ["tenant_message"]);
      assert.deepEqual(await m.messenger.handleWebhook(ev), ["tenant_message_duplicate"], "Meta retries are ignored");
      const msgs = await m.prisma.threadMessage.findMany({ where: { thread: { tenantId } } });
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].senderName, "Ana Test (via Messenger)");
      assert.ok(sends().some((s) => (s.body!.recipient as { id: string }).id === "psid-owner"), "office user was alerted");
    });

    test("office reply alerts the tenant on Messenger", async () => {
      on();
      const thread = await m.prisma.messageThread.findFirstOrThrow({ where: { tenantId } });
      await m.messages.reply(admin, thread.id, { body: "Yes, the 16th is fine." });
      const toAna = sends().filter((s) => (s.body!.recipient as { id: string }).id === "psid-ana");
      assert.equal(toAna.length, 1);
      assert.match((toAna[0].body!.message as { text: string }).text, /Yes, the 16th is fine\./);
    });

    test("unknown senders get instructions; STOP turns alerts off", async () => {
      on();
      assert.deepEqual(await m.messenger.handleWebhook(text("psid-stranger", "hello")), ["unknown_sender"]);
      assert.deepEqual(await m.messenger.handleWebhook(text("psid-ana", "STOP")), ["stopped"]);
      assert.deepEqual(await m.messenger.linkStatus({ kind: "TENANT", tenantId }, accountId), { available: true, linked: false });
      sent = [];
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.equal(sends().length, 0);
    });

    test("another landlord's tenants use that landlord's Page", async () => {
      on();
      const u = await conn({ kind: "TENANT", tenantId: otherAccountTenantId }, otherAccountId);
      assert.match(u, new RegExp(`^https://m\\.me/${OTHER_PAGE}\\?ref=`), "falls back to the Page ID without a username");
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-cara", refOf(u), OTHER_PAGE)), ["linked"]);
      assert.ok(sends().at(-1)!.url.includes("access_token=page-token-2"));
    });
  });

  describe("Connect Facebook Page (Settings → Integrations)", () => {
    test("login link carries a signed state; callbacks from another session or with a bad state are refused", async () => {
      on();
      const url = new URL(m.facebook.startConnect(admin));
      assert.equal(url.hostname, "www.facebook.com");
      assert.equal(url.searchParams.get("client_id"), "app-123");
      assert.match(url.searchParams.get("scope")!, /pages_messaging/);
      const state = url.searchParams.get("state")!;
      await assert.rejects(m.facebook.handleCallback(otherAdmin, { code: "c", state }), /expired or belongs to another session/);
      await assert.rejects(m.facebook.handleCallback(admin, { code: "c", state: "forged" }), /expired or belongs to another session/);
      await assert.rejects(m.facebook.handleCallback(admin, { error: "access_denied", state }), /cancelled/);
      assert.throws(() => m.facebook.startConnect({ kind: "TENANT", id: tenantId, role: "TENANT", accountId, tenantId }), /access/i);
    });

    test("callback lists only Pages the user can message for; choosing one subscribes the app and replaces the old Page", async () => {
      on();
      const state = new URL(m.facebook.startConnect(admin)).searchParams.get("state")!;
      graphReplies = {
        "grant_type=fb_exchange_token": { access_token: "long-user-token" },
        "/oauth/access_token?": { access_token: "short-user-token" },
        "/me?fields=id": { id: "fb-user-77" },
        "/me/accounts": { data: [{ id: `new-${tag}`, name: "Dawson New Page", username: "DawsonNew", access_token: "new-page-token", tasks: ["MANAGE", "MESSAGING"] }, { id: "analyst-only", name: "Read-only Page", access_token: "t", tasks: ["ANALYZE"] }] },
      };
      const reqId = await m.facebook.handleCallback(admin, { code: "the-code", state });
      assert.ok(sent.some((s) => s.url.includes("code=the-code") && s.url.includes("client_secret=app-secret")));
      const pages = await m.facebook.pendingPages(admin, reqId);
      assert.deepEqual(pages!.map((p) => p.name), ["Dawson New Page"], "Pages without messaging rights are left out");
      assert.equal(await m.facebook.pendingPages(otherAdmin, reqId), null, "another account can't see the picker");
      await assert.rejects(m.facebook.choosePage(otherAdmin, reqId, `new-${tag}`), /expired/);
      sent = [];
      const chosen = await m.facebook.choosePage(admin, reqId, `new-${tag}`);
      assert.equal(chosen.pageName, "Dawson New Page");
      const sub = sent.find((s) => s.url.includes(`/new-${tag}/subscribed_apps`));
      assert.ok(sub && sub.method === "POST" && sub.url.includes("messaging_referrals") && sub.url.includes("access_token=new-page-token"));
      const row = await m.prisma.messengerPage.findUniqueOrThrow({ where: { accountId } });
      assert.equal(row.pageId, `new-${tag}`);
      assert.equal(m.box.open(row.pageTokenEnc), "new-page-token");
      assert.equal(await m.prisma.messengerLink.count({ where: { pageId: PAGE, unlinkedAt: null } }), 0, "links on the old Page are ended");
      assert.equal(await m.prisma.facebookConnectRequest.count({ where: { id: reqId } }), 0);
    });

    test("a Page connected to one account can't be taken by another", async () => {
      on();
      const state = new URL(m.facebook.startConnect(otherAdmin)).searchParams.get("state")!;
      graphReplies = {
        "grant_type=fb_exchange_token": { access_token: "l" },
        "/oauth/access_token?": { access_token: "s" },
        "/me?fields=id": { id: "fb-user-88" },
        "/me/accounts": { data: [{ id: `new-${tag}`, name: "Dawson New Page", access_token: "x", tasks: ["MESSAGING"] }] },
      };
      const reqId = await m.facebook.handleCallback(otherAdmin, { code: "c", state });
      await assert.rejects(m.facebook.choosePage(otherAdmin, reqId, `new-${tag}`), /already connected to another TenantHub account/);
    });

    test("templates are created on the Page and wait for Meta's approval", async () => {
      on();
      graphReplies = { "/message_templates": { id: "t1", status: "PENDING" } };
      const r = await m.facebook.setupTemplates(admin);
      assert.deepEqual([r.tenantTemplateStatus, r.officeTemplateStatus], ["PENDING", "PENDING"]);
      const created = sent.filter((s) => s.url.includes("/message_templates"));
      assert.equal(created.length, 2);
      assert.equal((created[0].body as { category: string }).category, "UTILITY");
    });

    test("data deletion: Meta's signed request removes that Facebook user's connections", async () => {
      on();
      const payload = Buffer.from(JSON.stringify({ user_id: "fb-user-77", algorithm: "HMAC-SHA256" })).toString("base64url");
      const sig = crypto.createHmac("sha256", "app-secret").update(payload).digest("base64url");
      assert.equal(m.facebook.parseSignedRequest(`${sig}x.${payload}`), null);
      assert.equal(m.facebook.parseSignedRequest(`${sig}.${payload}`)!.user_id, "fb-user-77");
      const r = await m.facebook.deleteFacebookUserData("fb-user-77");
      assert.equal(r.pages, 1);
      assert.equal(await m.prisma.messengerPage.count({ where: { accountId } }), 0);
      assert.equal((await m.facebook.integrationStatus(admin)).page, null);
    });

    test("disconnect ends every link on the Page", async () => {
      on();
      const res = await m.facebook.disconnectPage(otherAdmin);
      assert.equal(res.disconnected, true);
      assert.equal(await m.prisma.messengerLink.count({ where: { pageId: OTHER_PAGE, unlinkedAt: null } }), 0);
      assert.ok(sent.some((s) => s.url.includes(`/${OTHER_PAGE}/subscribed_apps`) && s.method === "DELETE"));
    });
  });
}
