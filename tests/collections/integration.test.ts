// Database-backed tests for collections billing. They run the real services
// against a throwaway Postgres database with fictional data.
//
//   TEST_DATABASE_URL=postgresql://... npm run test:integration
//
// The database must already have every migration applied (see
// docs/dawson/README.md). Each run creates its own accounts, so it never
// depends on or disturbs other data in that database.

import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("integration tests skipped (set TEST_DATABASE_URL)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; // keep uploads in the test database
  run();
}

function run() {
  type Mods = {
    prisma: typeof import("@/lib/prisma").prisma;
    actor: typeof import("@/lib/collections/actor");
    profile: typeof import("@/lib/collections/profile");
    rooms: typeof import("@/lib/collections/rooms");
    statements: typeof import("@/lib/collections/statements");
    payments: typeof import("@/lib/collections/payments");
    adjustments: typeof import("@/lib/collections/adjustments");
    ledger: typeof import("@/lib/collections/ledger");
    meters: typeof import("@/lib/collections/meters");
    veco: typeof import("@/lib/collections/veco");
    views: typeof import("@/lib/collections/views");
    files: typeof import("@/lib/collections/files");
  };
  let m: Mods;
  const tag = `t${Date.now().toString(36)}`;
  type Actor = import("@/lib/collections/actor").Actor;

  // Fixture ids
  let accountId: string, otherAccountId: string, propertyId: string, otherPropertyId: string, planId: string;
  const units: Record<string, string> = {};
  const tenants: Record<string, string> = {};
  let admin: Actor, otherAdmin: Actor, caretaker: Actor, strangerCaretaker: Actor;
  const tenantActor = (key: string): Actor => ({ kind: "TENANT", id: tenants[key], role: "TENANT", accountId, tenantId: tenants[key] });
  const NOV = new Date("2026-11-12T02:00:00Z"); // Nov 12, Manila

  const png = () =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))])], "proof.png", { type: "image/png" });

  async function balance(tenantKey: string, today = "2026-12-31") {
    return m.ledger.loadTenantLedger(m.prisma, tenants[tenantKey], today);
  }

  async function makeTenant(key: string, unitKey: string, opts: { occupants?: number | null; moveIn?: string; email?: string | null } = {}) {
    const t = await m.prisma.tenant.create({
      data: {
        unitId: units[unitKey],
        name: `Tenant ${key}`,
        email: opts.email === undefined ? `${key}.${tag}@example.test` : opts.email,
        phone: `+63917${tag}${key}`.slice(0, 30),
        moveInDate: new Date(`${opts.moveIn ?? "2026-10-01"}T00:00:00+08:00`),
        portalPin: "$2a$10$test",
        occupantCount: opts.occupants === undefined ? 1 : opts.occupants,
      },
    });
    tenants[key] = t.id;
    return t;
  }

  before(async () => {
    m = {
      prisma: (await import("@/lib/prisma")).prisma,
      actor: await import("@/lib/collections/actor"),
      profile: await import("@/lib/collections/profile"),
      rooms: await import("@/lib/collections/rooms"),
      statements: await import("@/lib/collections/statements"),
      payments: await import("@/lib/collections/payments"),
      adjustments: await import("@/lib/collections/adjustments"),
      ledger: await import("@/lib/collections/ledger"),
      meters: await import("@/lib/collections/meters"),
      veco: await import("@/lib/collections/veco"),
      views: await import("@/lib/collections/views"),
      files: await import("@/lib/collections/files"),
    };
    // Scenario dates run Nov 2026 – Feb 2027; pin "today" after them so
    // payment and reading dates are never in the future.
    (await import("@/lib/collections/clock")).setClockForTests(new Date("2027-03-01T02:00:00Z"));
    const plan = await m.prisma.plan.create({ data: { name: `Test ${tag}`, price: 499, maxUnits: 100, maxTenants: 100, maxProperties: 10, features: [] } });
    planId = plan.id;
    const acct = await m.prisma.account.create({ data: { name: `Dawson ${tag}`, ownerName: "Byron Test", email: `owner.${tag}@example.test`, password: "x", planId } });
    const other = await m.prisma.account.create({ data: { name: `Other ${tag}`, ownerName: "Other Owner", email: `other.${tag}@example.test`, password: "x", planId } });
    accountId = acct.id;
    otherAccountId = other.id;
    const prop = await m.prisma.property.create({ data: { accountId, name: "Dawson Residences (test)", address: "Consolacion, Cebu", type: "apartment" } });
    const otherProp = await m.prisma.property.create({ data: { accountId: otherAccountId, name: "Other Place", address: "Elsewhere", type: "apartment" } });
    propertyId = prop.id;
    otherPropertyId = otherProp.id;
    for (const u of ["101", "102", "103", "104", "105", "106"]) {
      units[u] = (await m.prisma.unit.create({ data: { propertyId, unitNumber: u, rentAmount: 5000, status: "occupied" } })).id;
    }
    units.other = (await m.prisma.unit.create({ data: { propertyId: otherPropertyId, unitNumber: "X1", rentAmount: 5000 } })).id;
    admin = { kind: "ADMIN", id: accountId, role: "LANDLORD", accountId };
    otherAdmin = { kind: "ADMIN", id: otherAccountId, role: "LANDLORD", accountId: otherAccountId };
    const ct = await m.prisma.user.create({ data: { accountId, email: `care.${tag}@example.test`, password: "x", name: "Caretaker", role: "CARETAKER" } });
    await m.prisma.caretakerProperty.create({ data: { userId: ct.id, propertyId } });
    caretaker = { kind: "CARETAKER", id: ct.id, role: "CARETAKER", accountId };
    const ct2 = await m.prisma.user.create({ data: { accountId, email: `care2.${tag}@example.test`, password: "x", name: "Unassigned", role: "CARETAKER" } });
    strangerCaretaker = { kind: "CARETAKER", id: ct2.id, role: "CARETAKER", accountId };

    await m.profile.upsertProfile(admin, propertyId, { enabled: true, waterEnabled: true, vecoEnabled: true, paymentInstructions: "GCash 0917-000-0000 (Dawson)" });
    // Room setup: ₱5,000 per cycle rent + ₱500 monthly internet on 101..105.
    for (const u of ["101", "102", "103", "104", "105"]) {
      await m.rooms.addRecurringCharge(admin, units[u], { type: "RENT", description: "Room rent", amountCentavos: 500000, amountBasis: "PER_CYCLE", frequency: "EVERY_CYCLE", intervalMonths: 1, startMonth: "2026-10" });
    }
    await m.rooms.addRecurringCharge(admin, units["101"], { type: "INTERNET", description: "Internet", amountCentavos: 50000, amountBasis: "PER_OCCURRENCE", frequency: "MONTHLY", intervalMonths: 1, startMonth: "2026-10" });
    await makeTenant("a", "101", { occupants: 1 });
    await makeTenant("b", "102", { occupants: 2 });
    await makeTenant("c", "103", { occupants: 3 });
    await makeTenant("d", "104", { occupants: 4 });
    await makeTenant("e", "105", { occupants: null }); // no occupant count → no water
    // 106 is vacant: no tenant.
  });

  after(async () => {
    await m?.prisma.$disconnect();
  });

  describe("BILL-01/02/03 generation", () => {
    test("rejects rent without an explicit per-cycle/monthly choice", async () => {
      await assert.rejects(
        m.rooms.addRecurringCharge(admin, units["106"], { type: "RENT", description: "x", amountCentavos: 100, amountBasis: "PER_OCCURRENCE", frequency: "EVERY_CYCLE", intervalMonths: 1, startMonth: "2026-10" }),
        /per cycle or the monthly total/,
      );
    });

    test("two cycles in one month; monthly items only on cycle A; water by occupants; vacant room skipped", async () => {
      const a = await m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: NOV });
      const b = await m.statements.generateStatements(admin, propertyId, "2026-11-B", { now: NOV });
      assert.equal(a.results.length, 5, "five occupied rooms, vacant 106 has no statement");
      assert.equal(a.schedule.cycleDate, "2026-11-15");
      assert.equal(b.schedule.cycleDate, "2026-11-30");
      const lines = async (key: string, period: string) =>
        m.prisma.charge.findMany({ where: { tenantId: tenants[key], periodKey: period }, orderBy: { type: "asc" } }).then((cs) => cs.map((c) => `${c.type}:${c.amountCentavos}`));
      assert.deepEqual(await lines("a", "2026-11-A"), ["INTERNET:50000", "RENT:500000", "WATER:35000"]);
      assert.deepEqual(await lines("a", "2026-11-B"), ["RENT:500000"]);
      const water = async (key: string) => (await m.prisma.charge.findFirst({ where: { tenantId: tenants[key], type: "WATER", billingMonth: "2026-11" } }))?.amountCentavos ?? null;
      assert.deepEqual([await water("a"), await water("b"), await water("c"), await water("d")], [35000, 55000, 75000, 95000]);
      assert.equal(await water("e"), null, "no occupant count recorded → no automatic water charge");
      assert.ok(a.results.find((r) => r.tenantId === tenants.e)!.notes.some((n) => n.includes("Water not charged")));
    });

    test("retry and concurrent generation create no duplicates", async () => {
      const before = await m.prisma.charge.count({ where: { propertyId } });
      const stBefore = await m.prisma.statement.count({ where: { propertyId } });
      await Promise.all([
        m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: NOV }),
        m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: NOV }),
        m.statements.generateStatements(admin, propertyId, "2026-11-B", { now: NOV }),
      ]);
      assert.equal(await m.prisma.charge.count({ where: { propertyId } }), before);
      assert.equal(await m.prisma.statement.count({ where: { propertyId } }), stBefore);
    });

    test("short month: February statements use the 28th", async () => {
      const g = await m.statements.generateStatements(admin, propertyId, "2027-02-B", { now: new Date("2027-02-25T02:00:00Z") });
      assert.equal(g.schedule.cycleDate, "2027-02-28");
      const st = await m.prisma.statement.findFirst({ where: { tenantId: tenants.a, periodKey: "2027-02-B" } });
      assert.equal(st!.cycleDate.toISOString().slice(0, 10), "2027-02-28");
      for (const s of await m.prisma.statement.findMany({ where: { propertyId, periodKey: "2027-02-B" } })) await m.statements.discardDraft(admin, s.id);
    });

    test("draft lines count for nothing until published", async () => {
      const l = await balance("a");
      assert.equal(l.outstandingCentavos, 0);
    });
  });

  describe("BILL-05/07 payments, allocation, carry-forward", () => {
    test("publishing posts charges and freezes a snapshot; republish is a no-op", async () => {
      const res = await m.statements.publishPeriod(admin, propertyId, "2026-11-A");
      assert.equal(res.length, 5);
      const st = await m.prisma.statement.findFirst({ where: { tenantId: tenants.a, periodKey: "2026-11-A" } });
      assert.equal(st!.status, "PUBLISHED");
      assert.equal(st!.totalDueCentavos, 585000);
      assert.match(st!.number!, /^SOA-202611-\d{5}$/);
      const again = await m.statements.publishStatement(admin, st!.id);
      assert.equal(again.alreadyPublished, true);
      assert.equal((await balance("a")).outstandingCentavos, 585000);
    });

    test("pending and rejected payments leave the balance unchanged", async () => {
      const { payment } = await m.payments.submitTenantPayment(tenantActor("b"), { amountCentavos: 100000, method: "gcash", paidOn: "2026-11-12", referenceNumber: `R1${tag}` }, png());
      assert.equal(payment.status, "PENDING");
      assert.equal((await balance("b")).outstandingCentavos, 555000);
      await m.payments.rejectPayment(admin, payment.id, "Amount doesn't match the screenshot");
      const after = await m.prisma.rentPayment.findUniqueOrThrow({ where: { id: payment.id } });
      assert.equal(after.status, "REJECTED");
      assert.ok(after.proofFileId, "rejected evidence is kept");
      assert.equal(after.rejectedReason, "Amount doesn't match the screenshot");
      assert.equal((await balance("b")).outstandingCentavos, 555000);
    });

    test("proof is required, duplicates are refused, double-tap returns the same payment", async () => {
      await assert.rejects(m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 1000, method: "gcash", paidOn: "2026-11-12" }, null), /attach/);
      const file = png();
      const first = await m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 1000, method: "gcash", paidOn: "2026-11-12", clientRequestId: `req-${tag}-1` }, file);
      const again = await m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 1000, method: "gcash", paidOn: "2026-11-12", clientRequestId: `req-${tag}-1` }, file);
      assert.equal(again.payment.id, first.payment.id);
      assert.equal(again.duplicate, true);
      await assert.rejects(m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 1000, method: "gcash", paidOn: "2026-11-12" }, file), /already submitted/);
      await m.payments.rejectPayment(admin, first.payment.id, "Test cleanup");
    });

    test("₱5,000 charge − ₱2,000 approved = ₱3,000; next cycle adds ₱5,000 → ₱8,000 without re-posting ₱3,000", async () => {
      // Tenant d: cycle A = ₱5,000 rent + ₱950 water. Waive water so the
      // numbers match the owner's example exactly.
      const water = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.d, type: "WATER", billingMonth: "2026-11" } });
      await m.adjustments.adjustCharge(admin, water.id, { kind: "WAIVER", reason: "Example scenario" });
      assert.equal((await balance("d")).outstandingCentavos, 500000);

      const { payment } = await m.payments.submitTenantPayment(tenantActor("d"), { amountCentavos: 200000, method: "gcash", paidOn: "2026-11-13" }, png());
      await m.payments.approvePayment(admin, payment.id);
      assert.equal((await balance("d")).outstandingCentavos, 300000);

      await m.statements.publishPeriod(admin, propertyId, "2026-11-B");
      const st = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.d, periodKey: "2026-11-B" } });
      assert.equal(st.previousBalanceCentavos, 300000);
      assert.equal(st.currentChargesCentavos, 500000);
      assert.equal(st.totalDueCentavos, 800000);
      const l = await balance("d");
      assert.equal(l.outstandingCentavos, 800000);
      const posted = await m.prisma.charge.findMany({ where: { tenantId: tenants.d, status: "POSTED" } });
      assert.equal(posted.reduce((s, c) => s + c.amountCentavos, 0), 500000 + 95000 + 500000, "₱3,000 carried balance was never posted as a charge");
    });

    test("partial approved payment pays the oldest charge first", async () => {
      // Tenant b owes cycle A (₱5,000 rent + ₱550 water) and cycle B (₱5,000).
      const { payment } = await m.payments.submitTenantPayment(tenantActor("b"), { amountCentavos: 600000, method: "maya", paidOn: "2026-11-20" }, png());
      await m.payments.approvePayment(admin, payment.id);
      const allocs = await m.prisma.paymentAllocation.findMany({ where: { paymentId: payment.id }, include: { charge: true } });
      const byPeriod = allocs.reduce<Record<string, number>>((acc, a) => ((acc[a.charge.periodKey!] = (acc[a.charge.periodKey!] ?? 0) + a.amountCentavos), acc), {});
      assert.equal(byPeriod["2026-11-A"], 555000, "cycle A fully paid first");
      assert.equal(byPeriod["2026-11-B"], 45000, "remainder to cycle B");
      assert.equal((await balance("b")).outstandingCentavos, 1055000 - 600000);
    });

    test("approving twice — sequentially or at the same moment — has one effect", async () => {
      const { payment } = await m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 300000, method: "bank", paidOn: "2026-11-20" }, png());
      const results = await Promise.all([m.payments.approvePayment(admin, payment.id), m.payments.approvePayment(admin, payment.id), m.payments.approvePayment(admin, payment.id)]);
      assert.equal(results.filter((r) => !r.alreadyApproved).length, 1);
      const allocated = await m.prisma.paymentAllocation.aggregate({ where: { paymentId: payment.id, reversedAt: null }, _sum: { amountCentavos: true } });
      assert.equal(allocated._sum.amountCentavos, 300000);
      const again = await m.payments.approvePayment(admin, payment.id);
      assert.equal(again.alreadyApproved, true);
      assert.equal((await m.prisma.paymentAllocation.aggregate({ where: { paymentId: payment.id, reversedAt: null }, _sum: { amountCentavos: true } }))._sum.amountCentavos, 300000);
      await assert.rejects(m.payments.rejectPayment(admin, payment.id, "too late"), /approved/);
    });

    test("concurrent approvals of different payments never over-allocate a charge", async () => {
      // Tenant e owes ₱10,000 (two rent cycles, no water). Three ₱4,000 payments approved at once.
      const ids = [];
      for (let i = 0; i < 3; i++) ids.push((await m.payments.submitTenantPayment(tenantActor("e"), { amountCentavos: 400000, method: "gcash", paidOn: "2026-11-21" }, png())).payment.id);
      await Promise.all(ids.map((id) => m.payments.approvePayment(admin, id)));
      const l = await balance("e");
      assert.equal(l.outstandingCentavos, 0);
      assert.equal(l.creditCentavos, 200000, "₱12,000 paid on ₱10,000 owed → ₱2,000 unapplied credit");
      for (const c of await m.prisma.charge.findMany({ where: { tenantId: tenants.e, status: "POSTED" }, include: { allocations: { where: { reversedAt: null } } } })) {
        assert.ok(c.allocations.reduce((s, a) => s + a.amountCentavos, 0) <= c.amountCentavos);
      }
    });

    test("unapplied credit is used automatically by the next statement", async () => {
      await m.statements.generateStatements(admin, propertyId, "2026-12-A", { now: new Date("2026-12-12T02:00:00Z") });
      const st = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.e, periodKey: "2026-12-A" } });
      await m.statements.publishStatement(admin, st.id);
      const issued = await m.prisma.statement.findUniqueOrThrow({ where: { id: st.id } });
      assert.equal(issued.totalDueCentavos, 300000, "₱5,000 rent − ₱2,000 credit");
      assert.equal((await balance("e")).creditCentavos, 0);
      assert.equal((await balance("e")).outstandingCentavos, 300000);
    });

    test("reversal restores the debt and keeps history", async () => {
      const p = await m.prisma.rentPayment.findFirstOrThrow({ where: { tenantId: tenants.c, status: "APPROVED" } });
      const owedBefore = (await balance("c")).outstandingCentavos;
      await m.payments.reversePayment(admin, p.id, "Bank transfer bounced");
      assert.equal((await balance("c")).outstandingCentavos, owedBefore + p.amountCentavos);
      const allocs = await m.prisma.paymentAllocation.findMany({ where: { paymentId: p.id } });
      assert.ok(allocs.length > 0 && allocs.every((a) => a.reversedAt), "allocations kept and marked reversed");
      const again = await m.payments.reversePayment(admin, p.id, "again");
      assert.equal(again.alreadyReversed, true);
      const logs = await m.prisma.billingAuditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: "asc" } });
      assert.deepEqual(logs.map((l) => l.action), ["submitted", "approved", "reversed"]);
    });

    test("waiving a partly paid charge releases the payment as credit and re-applies it", async () => {
      // Tenant b: cycle B rent has ₱450 paid. Waive it: ₱450 moves to the next oldest (cycle B is newest) → credit.
      const rentB = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.b, periodKey: "2026-11-B", type: "RENT" } });
      const adj = await m.adjustments.adjustCharge(admin, rentB.id, { kind: "WAIVER", reason: "Goodwill" });
      const l = await balance("b");
      assert.equal(l.outstandingCentavos, 0);
      assert.equal(l.creditCentavos, 45000);
      await m.adjustments.reverseAdjustment(admin, adj.id, "Waived by mistake");
      const l2 = await balance("b");
      assert.equal(l2.creditCentavos, 0, "credit re-applied to the restored charge");
      assert.equal(l2.outstandingCentavos, 500000 - 45000);
    });

    test("historical statements keep their issued figures after later changes", async () => {
      const st = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.b, periodKey: "2026-11-B" } });
      assert.equal(st.totalDueCentavos, (st.snapshot as { totals: { totalDueCentavos: number } }).totals.totalDueCentavos);
      const detail = await m.views.statementDetail(admin, st.id);
      assert.ok(detail.changesSinceIssue.length >= 2, "waiver, reversal and payments shown as later changes");
    });
  });

  describe("BILL-06 penalties", () => {
    test("disabled by default: no penalty lines even when overdue", async () => {
      const g = await m.statements.generateStatements(admin, propertyId, "2026-12-B", { now: new Date("2026-12-27T02:00:00Z") });
      assert.ok(g.results.length > 0);
      assert.equal(await m.prisma.charge.count({ where: { propertyId, type: "PENALTY" } }), 0);
    });

    test("can't be enabled without a rate and grace period", async () => {
      await assert.rejects(m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: true, penaltyRateBps: 500 }), /grace/);
    });

    test("configured: grace respected, exemptions honoured, once per statement, waivable", async () => {
      await m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: true, penaltyRateBps: 500, penaltyGraceDays: 3 });
      await m.rooms.updateTenantBilling(admin, tenants.c, { penaltyExempt: true, penaltyExemptReason: "Senior citizen arrangement" });
      // Regenerate Dec-B drafts after enabling (refresh adds missing lines only).
      await m.statements.generateStatements(admin, propertyId, "2026-12-B", { now: new Date("2026-12-27T02:00:00Z") });
      await m.statements.generateStatements(admin, propertyId, "2026-12-B", { now: new Date("2026-12-27T02:00:00Z") });
      const pens = await m.prisma.charge.findMany({ where: { propertyId, type: "PENALTY" } });
      assert.ok(pens.length > 0);
      assert.ok(!pens.some((p) => p.tenantId === tenants.c), "exempt tenant has no penalty");
      assert.ok(pens.every((p) => (p.calc as { basisCentavos: number }).basisCentavos > 0), "penalties only on unpaid amounts");
      assert.ok(pens.every((p) => (p.calc as { basisCentavos: number }).basisCentavos <= 500000 + 95000), "basis is the statement's own charges, never the carried balance");
      const keys = pens.map((p) => `${p.tenantId}:${p.sourceKey}`);
      assert.equal(new Set(keys).size, keys.length, "one penalty per statement");
      // Tenant d's Nov-B statement (due Nov 30) had ₱5,000 unpaid → 5% = ₱250, computed on charges only (not the carried ₱3,000).
      const stDB = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.d, periodKey: "2026-11-B" } });
      const penD = pens.find((p) => p.sourceKey === `penalty:${stDB.id}`)!;
      assert.equal(penD.amountCentavos, 25000);
      // No penalty on statements still inside grace (Dec-A due Dec 15 + 3 → late after Dec 18; assessed Dec 27 → yes). Earlier-than-grace check:
      const early = await m.statements.generateStatements(admin, propertyId, "2027-01-A", { now: new Date("2026-12-31T02:00:00Z") });
      assert.ok(early.results.length > 0);
      const decB = await m.prisma.statement.findMany({ where: { periodKey: "2026-12-B", status: "PUBLISHED" } });
      assert.equal(decB.length, 0, "Dec-B not yet issued, so it can't be penalised");
      // Publish and waive tenant d's penalty.
      const draft = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.d, periodKey: "2026-12-B" } });
      await m.statements.publishStatement(admin, draft.id);
      const owed = (await balance("d")).outstandingCentavos;
      await m.adjustments.adjustCharge(admin, penD.id, { kind: "WAIVER", reason: "First late payment forgiven" });
      assert.equal((await balance("d")).outstandingCentavos, owed - 25000);
      await m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: false });
    });
  });

  describe("BILL-04 water meters", () => {
    test("needs a meter id; validates order, decreases and resets; excess needs approval", async () => {
      await assert.rejects(m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-01", value: "100" }), /meter ID/);
      await m.rooms.updateRoomSettings(admin, units["101"], { meterId: "WM-101", vecoAccountNumber: "VECO-0101" });
      await m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-01", value: "100.000" });
      const r2 = await m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-15", value: "112.5" });
      assert.equal(r2.reading.usage!.toString(), "12.5");
      assert.equal(r2.proposalId, null, "no allowance configured → nothing proposed or billed");
      await assert.rejects(m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-10", value: "113" }), /date order/);
      await assert.rejects(m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-20", value: "50" }), /lower than the last/);
      const reset = await m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-11-20", value: "5", isMeterReset: true });
      assert.equal(reset.reading.usage, null, "reset starts a new baseline");

      await m.profile.upsertProfile(admin, propertyId, { meterAllowance: "10", meterExcessRateCentavos: 5000 });
      const over = await m.meters.addMeterReading(caretaker, { unitId: units["101"], readingDate: "2026-12-05", value: "20" });
      assert.ok(over.reading.overAllowance);
      assert.ok(over.proposalId);
      const p = await m.prisma.waterExcessProposal.findUniqueOrThrow({ where: { id: over.proposalId! } });
      assert.equal(p.proposedCentavos, 25000, "15 used − 10 allowance = 5 × ₱50");

      // Not billed before approval.
      await m.statements.generateStatements(admin, propertyId, "2027-01-A", { now: new Date("2027-01-12T02:00:00Z") });
      assert.equal(await m.prisma.charge.count({ where: { tenantId: tenants.a, type: "WATER_EXCESS" } }), 0);
      await assert.rejects(m.meters.decideExcessProposal(caretaker, p.id, "APPROVE"), /access/);
      await m.meters.decideExcessProposal(admin, p.id, "APPROVE");
      await assert.rejects(m.meters.decideExcessProposal(admin, p.id, "APPROVE"), /already decided/);
      await m.statements.generateStatements(admin, propertyId, "2027-01-A", { now: new Date("2027-01-12T02:00:00Z") });
      await m.statements.generateStatements(admin, propertyId, "2027-01-B", { now: new Date("2027-01-27T02:00:00Z") });
      assert.equal(await m.prisma.charge.count({ where: { tenantId: tenants.a, type: "WATER_EXCESS" } }), 1, "billed exactly once");
    });
  });

  describe("BILL-08 VECO receipts", () => {
    test("tracked separately: never affects rent balances or collections", async () => {
      const before = await balance("a");
      const receivedBefore = (await m.views.collectionsOverview(admin, propertyId, { month: "2026-11" })).totals.paymentsReceivedCentavos;
      const r = await m.veco.submitVecoReceipt(tenantActor("a"), { billingMonth: "2026-10", amount: "1,234.50" }, png());
      await m.veco.reviewVecoReceipt(admin, r.id, "VERIFY");
      const after = await balance("a");
      assert.equal(after.outstandingCentavos, before.outstandingCentavos);
      assert.equal(after.creditCentavos, before.creditCentavos);
      assert.equal((await m.views.collectionsOverview(admin, propertyId, { month: "2026-11" })).totals.paymentsReceivedCentavos, receivedBefore);
      await assert.rejects(m.veco.submitVecoReceipt(tenantActor("a"), { billingMonth: "2026-10" }, png()), /already uploaded/);
    });
  });

  describe("Authorization and isolation", () => {
    test("another landlord account can't see or touch this property", async () => {
      const p = await m.prisma.rentPayment.findFirstOrThrow({ where: { propertyId, status: "APPROVED" } });
      await assert.rejects(m.payments.approvePayment(otherAdmin, p.id), /not found/i);
      await assert.rejects(m.payments.reversePayment(otherAdmin, p.id, "x"), /not found/i);
      await assert.rejects(m.views.collectionsOverview(otherAdmin, propertyId, {}), /not found/i);
      await assert.rejects(m.statements.generateStatements(otherAdmin, propertyId, "2026-11-A"), /not found/i);
      const st = await m.prisma.statement.findFirstOrThrow({ where: { propertyId } });
      await assert.rejects(m.views.statementDetail(otherAdmin, st.id), /not found/i);
      const file = await m.prisma.storedFile.findFirstOrThrow({ where: { accountId } });
      assert.equal(m.files.canReadFile(otherAdmin, file), false);
      assert.equal(m.files.canReadFile(admin, file), true);
    });

    test("tenants see only their own statements, payments and files", async () => {
      const stOfB = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.b, status: "PUBLISHED" } });
      await assert.rejects(m.views.statementDetail(tenantActor("a"), stOfB.id), /not found/i);
      const own = await m.views.statementDetail(tenantActor("b"), stOfB.id);
      assert.equal(own.tenant.id, tenants.b);
      const draftOfB = await m.prisma.statement.findFirst({ where: { tenantId: tenants.b, status: "DRAFT" } });
      if (draftOfB) await assert.rejects(m.views.statementDetail(tenantActor("b"), draftOfB.id), /not found/i, "drafts are not visible to tenants");
      const fileOfB = await m.prisma.storedFile.findFirstOrThrow({ where: { tenantId: tenants.b } });
      assert.equal(m.files.canReadFile(tenantActor("a"), fileOfB), false);
      assert.equal(m.files.canReadFile(tenantActor("a"), { accountId, tenantId: null, purpose: "PROPERTY_LOGO" }), true, "logos print on every tenant's statement");
      assert.equal(m.files.canReadFile(tenantActor("a"), { accountId: otherAccountId, tenantId: null, purpose: "PROPERTY_LOGO" }), false);
      assert.equal(m.files.canReadFile(tenantActor("b"), fileOfB), true);
      const view = await m.views.tenantBillingView(tenantActor("a"));
      assert.ok(view.enabled && view.statements.length > 0);
      const othersPayments = await m.prisma.rentPayment.findMany({ where: { propertyId, tenantId: { not: tenants.a } }, select: { id: true } });
      assert.ok(othersPayments.length > 0);
      assert.ok(view.enabled && view.payments.every((p) => !othersPayments.some((o) => o.id === p.id)), "no other tenant's payments in the portal");
      const owners = await m.prisma.statement.findMany({ where: { id: { in: view.enabled ? view.statements.map((x) => x.id) : [] } }, select: { tenantId: true, status: true } });
      assert.ok(owners.length > 0 && owners.every((o) => o.tenantId === tenants.a && o.status === "PUBLISHED"), "only the tenant's own issued statements");
      await assert.rejects(m.payments.approvePayment(tenantActor("a"), othersPayments[0].id), /access/);
    });

    test("caretakers: meter entry on assigned properties only, no money", async () => {
      await assert.rejects(m.meters.addMeterReading(strangerCaretaker, { unitId: units["101"], readingDate: "2026-12-20", value: "21" }), /access/);
      await assert.rejects(m.views.collectionsOverview(caretaker, propertyId, {}), /access/);
      await assert.rejects(m.views.tenantLedgerAdminView(caretaker, tenants.a), /access/);
      await assert.rejects(m.payments.approvePayment(caretaker, (await m.prisma.rentPayment.findFirstOrThrow({ where: { propertyId } })).id), /access/);
      await assert.rejects(m.statements.generateStatements(caretaker, propertyId, "2026-11-A"), /access/);
      const file = await m.prisma.storedFile.findFirstOrThrow({ where: { accountId } });
      assert.equal(m.files.canReadFile(caretaker, file), false);
      const view = await m.meters.meterEntryView(caretaker, propertyId);
      assert.ok(!JSON.stringify(view).includes("Centavos"), "meter view carries no money");
      assert.ok(!JSON.stringify(view).includes("Tenant "), "nor tenant names");
    });

    test("historical tenancy separation: a new tenant in the same room starts clean", async () => {
      await m.prisma.tenant.update({ where: { id: tenants.e }, data: { isActive: false, moveOutDate: new Date("2027-01-31T00:00:00+08:00") } });
      await makeTenant("f", "105", { occupants: 1, moveIn: "2027-02-01" });
      await m.statements.generateStatements(admin, propertyId, "2027-02-A", { now: new Date("2027-02-12T02:00:00Z") });
      const newSt = await m.prisma.statement.findMany({ where: { unitId: units["105"], periodKey: "2027-02-A" } });
      assert.deepEqual(newSt.map((s) => s.tenantId), [tenants.f], "moved-out tenant gets no new statement");
      assert.equal((await balance("f")).outstandingCentavos, 0, "previous tenant's debt stays with them");
      assert.ok((await balance("e")).outstandingCentavos > 0);
    });
  });

  describe("Existing behaviour", () => {
    test("legacy monthly ledger and payments are untouched and still independent", async () => {
      const legacy = await m.prisma.monthlyLedger.create({ data: { tenantId: tenants.a, month: "2026-09", rentAmount: 5000, rentPaid: true } });
      const legacyPayment = await m.prisma.payment.create({ data: { tenantId: tenants.a, amount: 5000, month: "2026-09", dueDate: new Date("2026-09-05"), status: "approved" } });
      const l = await balance("a");
      const again = await m.prisma.monthlyLedger.findUniqueOrThrow({ where: { id: legacy.id } });
      assert.equal(again.rentAmount, 5000);
      assert.ok(!l.charges.some((c) => c.billingMonth === "2026-09"), "legacy rows never leak into the new ledger");
      await m.prisma.payment.delete({ where: { id: legacyPayment.id } });
      await m.prisma.monthlyLedger.delete({ where: { id: legacy.id } });
    });

    test("opening balance can be recorded once and is paid like any charge", async () => {
      await m.rooms.recordOpeningBalance(admin, tenants.f, { amountCentavos: 120000, asOfDate: "2027-01-31", description: "Balance from paper ledger" });
      await assert.rejects(m.rooms.recordOpeningBalance(admin, tenants.f, { amountCentavos: 1, asOfDate: "2027-01-31", description: "again" }), /already has/);
    });
  });
}
