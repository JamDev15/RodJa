// Messenger alerts: linking via signed m.me refs, webhook signature checks,
// the 24-hour window vs utility templates, dedupe, inbound replies and STOP.
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
    events: typeof import("@/lib/messenger/events");
    messages: typeof import("@/lib/operations/messages");
    tokens: typeof import("@/lib/tokens");
  };
  const tag = `m${Date.now().toString(36)}`;
  const PAGE = `page-${tag}`;
  let accountId: string, propertyId: string, tenantId: string, otherTenantId: string, caretakerId: string;
  let admin: Actor;
  let sent: { url: string; body: Record<string, unknown> }[] = [];
  let failNext = false;

  const env = { MESSENGER_PAGE_ID: PAGE, MESSENGER_PAGE_ACCESS_TOKEN: "page-token", MESSENGER_APP_SECRET: "app-secret", MESSENGER_VERIFY_TOKEN: "verify-me", MESSENGER_PAGE_USERNAME: "DawsonResidences" };
  const on = () => Object.assign(process.env, env);
  const off = () => Object.keys(env).forEach((k) => delete process.env[k]);
  const refOf = (u: string) => decodeURIComponent(new URL(u).searchParams.get("ref")!);
  const postback = (psid: string, ref: string) => ({ object: "page", entry: [{ id: PAGE, messaging: [{ sender: { id: psid }, postback: { referral: { ref } } }] }] });
  const text = (psid: string, t: string, mid: string = crypto.randomUUID()) => ({ object: "page", entry: [{ id: PAGE, messaging: [{ sender: { id: psid }, message: { mid, text: t } }] }] });
  const texts = () => sent.map((s) => (s.body.message as { text?: string }).text ?? "");

  before(async () => {
    m = {
      prisma: (await import("@/lib/prisma")).prisma,
      profile: await import("@/lib/collections/profile"),
      messenger: await import("@/lib/messenger"),
      events: await import("@/lib/messenger/events"),
      messages: await import("@/lib/operations/messages"),
      tokens: await import("@/lib/tokens"),
    };
    m.messenger.setMessengerFetchForTests(async (u, init) => {
      sent.push({ url: u, body: JSON.parse(String(init.body)) });
      if (failNext) {
        failNext = false;
        return new Response('{"error":{"code":10}}', { status: 400 });
      }
      return new Response('{"message_id":"m1"}', { status: 200 });
    });
    const plan = await m.prisma.plan.create({ data: { name: `Msgr ${tag}`, price: 499, maxUnits: 100, maxTenants: 100, maxProperties: 10, features: [] } });
    const acct = await m.prisma.account.create({ data: { name: `Dawson msgr ${tag}`, ownerName: "Byron Test", email: `msgr.${tag}@example.test`, password: "x", planId: plan.id } });
    accountId = acct.id;
    admin = { kind: "ADMIN", id: accountId, role: "LANDLORD", accountId };
    propertyId = (await m.prisma.property.create({ data: { accountId, name: "Dawson (messenger test)", address: "Cebu", type: "apartment" } })).id;
    await m.profile.upsertProfile(admin, propertyId, { enabled: true });
    const unit = await m.prisma.unit.create({ data: { propertyId, unitNumber: "401", rentAmount: 5000, status: "occupied" } });
    const unit2 = await m.prisma.unit.create({ data: { propertyId, unitNumber: "402", rentAmount: 5000, status: "occupied" } });
    tenantId = (await m.prisma.tenant.create({ data: { unitId: unit.id, name: "Ana Test", phone: `+63917${tag}a`.slice(0, 30), moveInDate: new Date("2026-10-01T00:00:00+08:00"), portalPin: "x" } })).id;
    otherTenantId = (await m.prisma.tenant.create({ data: { unitId: unit2.id, name: "Ben Test", phone: `+63917${tag}b`.slice(0, 30), moveInDate: new Date("2026-10-01T00:00:00+08:00"), portalPin: "x", isActive: false } })).id;
    caretakerId = (await m.prisma.user.create({ data: { accountId, email: `msgr-care.${tag}@example.test`, password: "x", name: "Care", role: "CARETAKER" } })).id;
  });

  beforeEach(() => {
    sent = [];
  });

  after(async () => {
    off();
    m?.messenger.setMessengerFetchForTests(null);
    await m?.prisma.$disconnect();
  });

  describe("Messenger", () => {
    test("off without settings: no connect link, alerts are no-ops", async () => {
      off();
      assert.equal(m.messenger.connectUrl({ kind: "TENANT", tenantId }), null);
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.deepEqual(await m.messenger.handleWebhook(postback("p1", "x")), []);
      assert.equal(sent.length, 0);
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

    test("tenant connects through a signed m.me ref; tampered, expired and inactive refs are refused", async () => {
      on();
      const link = m.messenger.connectUrl({ kind: "TENANT", tenantId })!;
      assert.match(link, /^https:\/\/m\.me\/DawsonResidences\?ref=/);
      const ref = refOf(link);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", ref.slice(0, -2) + "xx")), ["bad_ref"]);
      const expired = m.tokens.createSignedToken("messenger", `t:${tenantId}`, -1);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", expired)), ["bad_ref"]);
      const inactive = refOf(m.messenger.connectUrl({ kind: "TENANT", tenantId: otherTenantId })!);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", inactive)), ["bad_ref"], "moved-out tenancies can't connect");
      const caretakerRef = refOf(m.messenger.connectUrl({ kind: "ADMIN", accountId, userId: caretakerId })!);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-x", caretakerRef)), ["bad_ref"], "caretakers don't get office alerts");
      assert.equal(await m.prisma.messengerLink.count({ where: { pageId: PAGE } }), 0);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-ana", ref)), ["linked"]);
      assert.match(texts().at(-1)!, /You're connected/);
      assert.deepEqual(await m.messenger.linkStatus({ kind: "TENANT", tenantId }), { available: true, linked: true });
    });

    test("inside 24 hours a plain text alert goes; the same event is never sent twice", async () => {
      on();
      const alert = { text: "Your statement is ready", path: "/tenant/billing", dedupeKey: `st:${tag}` };
      assert.equal(await m.messenger.alertTenant(tenantId, alert), 1);
      assert.equal(await m.messenger.alertTenant(tenantId, alert), 0);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].body.messaging_type, "UPDATE");
      assert.match(texts()[0], /Your statement is ready\nhttps?:\/\/.+\/tenant\/billing$/);
      assert.ok(!sent[0].url.includes("ACCOUNT_UPDATE"));
    });

    test("outside 24 hours: skipped without a template; with a utility template the params are cleaned", async () => {
      on();
      await m.prisma.messengerLink.updateMany({ where: { tenantId }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) } });
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.equal(sent.length, 0);
      const log = await m.prisma.messageLog.findFirst({ where: { tenantId, channel: "messenger" }, orderBy: { createdAt: "desc" } });
      assert.match(log!.error!, /24-hour window/);
      process.env.MESSENGER_TEMPLATE_TENANT = "tenant_account_update";
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "Payment of PHP 2,000.00 #1 was 100% verified $", path: "/tenant/billing" }), 1);
      const msg = sent[0].body as { messaging_type: string; message: { template: { name: string; components: { parameters: { text: string }[] }[] } } };
      assert.equal(msg.messaging_type, "UTILITY");
      assert.equal(msg.message.template.name, "tenant_account_update");
      const params = msg.message.template.components[0].parameters.map((p) => p.text);
      assert.equal(params[0], "Ana Test");
      assert.ok(params.every((p) => !/[#$%]/.test(p)), "Meta rejects #, $ and % in parameters");
      delete process.env.MESSENGER_TEMPLATE_TENANT;
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
      const ownerRef = refOf(m.messenger.connectUrl({ kind: "ADMIN", accountId, userId: accountId })!);
      assert.deepEqual(await m.messenger.handleWebhook(postback("psid-owner", ownerRef)), ["linked"]);
      sent = [];
      const ev = text("psid-ana", "Can I pay on the 16th?", `mid.${tag}`);
      assert.deepEqual(await m.messenger.handleWebhook(ev), ["tenant_message"]);
      assert.deepEqual(await m.messenger.handleWebhook(ev), ["tenant_message_duplicate"], "Meta retries are ignored");
      const msgs = await m.prisma.threadMessage.findMany({ where: { thread: { tenantId } } });
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].senderName, "Ana Test (via Messenger)");
      const ownerAlert = sent.find((s) => (s.body.recipient as { id: string }).id === "psid-owner");
      assert.ok(ownerAlert, "office user connected to Messenger was alerted");
      assert.ok(sent.some((s) => (s.body.recipient as { id: string }).id === "psid-ana" && /Sent to the office/.test(texts()[sent.indexOf(s)])));
    });

    test("office reply alerts the tenant on Messenger", async () => {
      on();
      const thread = await m.prisma.messageThread.findFirstOrThrow({ where: { tenantId } });
      await m.messages.reply(admin, thread.id, { body: "Yes, the 16th is fine." });
      const toAna = sent.filter((s) => (s.body.recipient as { id: string }).id === "psid-ana");
      assert.equal(toAna.length, 1);
      assert.match((toAna[0].body.message as { text: string }).text, /Yes, the 16th is fine\./);
    });

    test("unknown senders get instructions; STOP turns alerts off", async () => {
      on();
      assert.deepEqual(await m.messenger.handleWebhook(text("psid-stranger", "hello")), ["unknown_sender"]);
      assert.equal(await m.prisma.messengerLink.count({ where: { psid: "psid-stranger" } }), 0);
      assert.deepEqual(await m.messenger.handleWebhook(text("psid-ana", "STOP")), ["stopped"]);
      assert.deepEqual(await m.messenger.linkStatus({ kind: "TENANT", tenantId }), { available: true, linked: false });
      sent = [];
      assert.equal(await m.messenger.alertTenant(tenantId, { text: "x", path: "/" }), 0);
      assert.equal(sent.length, 0);
    });

    test("events from another Page are ignored", async () => {
      on();
      const ref = refOf(m.messenger.connectUrl({ kind: "TENANT", tenantId })!);
      const ev = { object: "page", entry: [{ id: "some-other-page", messaging: [{ sender: { id: "psid-z" }, postback: { referral: { ref } } }] }] };
      assert.deepEqual(await m.messenger.handleWebhook(ev), []);
    });
  });
}
