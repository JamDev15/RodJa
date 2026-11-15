// Database-backed tests for the Phase 1 follow-ups and Phase 2 (tenancy
// lifecycle and operations). Same setup as tests/collections:
//
//   TEST_DATABASE_URL=postgresql://... npm run test:integration
//
// Each run creates its own fictional accounts.

import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("operations integration tests skipped (set TEST_DATABASE_URL)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.RESEND_API_KEY; // emails fail fast; services must cope
  run();
}

function run() {
  type Actor = import("@/lib/collections/actor").Actor;
  let m: {
    prisma: typeof import("@/lib/prisma").prisma;
    profile: typeof import("@/lib/collections/profile");
    rooms: typeof import("@/lib/collections/rooms");
    statements: typeof import("@/lib/collections/statements");
    payments: typeof import("@/lib/collections/payments");
    ledger: typeof import("@/lib/collections/ledger");
    files: typeof import("@/lib/collections/files");
    documents: typeof import("@/lib/collections/documents");
    occupants: typeof import("@/lib/operations/occupants");
    checklists: typeof import("@/lib/operations/checklists");
    deposits: typeof import("@/lib/operations/deposits");
    leases: typeof import("@/lib/operations/leases");
    moveout: typeof import("@/lib/operations/moveout");
    maintenance: typeof import("@/lib/operations/maintenance");
    messages: typeof import("@/lib/operations/messages");
    announcements: typeof import("@/lib/operations/announcements");
    summary: typeof import("@/lib/operations/summary");
  };
  const tag = `o${Date.now().toString(36)}`;
  let accountId: string, otherAccountId: string, propertyId: string, plainPropertyId: string;
  const units: Record<string, string> = {};
  const tenants: Record<string, string> = {};
  let admin: Actor, otherAdmin: Actor, caretaker: Actor, strangerCaretaker: Actor;
  const tenantActor = (key: string): Actor => ({ kind: "TENANT", id: tenants[key], role: "TENANT", accountId, tenantId: tenants[key] });

  const png = (name = "photo.png") =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))])], name, { type: "image/png" });
  const pdf = () => new File([new TextEncoder().encode(`%PDF-1.4\n% ${Math.random()}\n`)], "lease.pdf", { type: "application/pdf" });
  const balance = (key: string) => m.ledger.loadTenantLedger(m.prisma, tenants[key], "2027-03-01");

  async function makeTenant(key: string, unitKey: string, opts: { moveIn?: string; occupants?: number | null } = {}) {
    const t = await m.prisma.tenant.create({
      data: {
        unitId: units[unitKey],
        name: `Tenant ${key}`,
        email: null, // no email → notification sends are skipped cleanly
        phone: `+63918${tag}${key}`.slice(0, 30),
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
      profile: await import("@/lib/collections/profile"),
      rooms: await import("@/lib/collections/rooms"),
      statements: await import("@/lib/collections/statements"),
      payments: await import("@/lib/collections/payments"),
      ledger: await import("@/lib/collections/ledger"),
      files: await import("@/lib/collections/files"),
      documents: await import("@/lib/collections/documents"),
      occupants: await import("@/lib/operations/occupants"),
      checklists: await import("@/lib/operations/checklists"),
      deposits: await import("@/lib/operations/deposits"),
      leases: await import("@/lib/operations/leases"),
      moveout: await import("@/lib/operations/moveout"),
      maintenance: await import("@/lib/operations/maintenance"),
      messages: await import("@/lib/operations/messages"),
      announcements: await import("@/lib/operations/announcements"),
      summary: await import("@/lib/operations/summary"),
    };
    (await import("@/lib/collections/clock")).setClockForTests(new Date("2027-03-01T02:00:00Z"));
    const plan = await m.prisma.plan.create({ data: { name: `Ops ${tag}`, price: 499, maxUnits: 100, maxTenants: 100, maxProperties: 10, features: [] } });
    const acct = await m.prisma.account.create({ data: { name: `Dawson ops ${tag}`, ownerName: "Byron Test", email: `ops.${tag}@example.test`, password: "x", planId: plan.id } });
    const other = await m.prisma.account.create({ data: { name: `Other ops ${tag}`, ownerName: "Other", email: `ops-other.${tag}@example.test`, password: "x", planId: plan.id } });
    accountId = acct.id;
    otherAccountId = other.id;
    propertyId = (await m.prisma.property.create({ data: { accountId, name: "Dawson Residences (ops test)", address: "Consolacion, Cebu", type: "apartment" } })).id;
    plainPropertyId = (await m.prisma.property.create({ data: { accountId, name: "Plain property (no Dawson features)", address: "Elsewhere", type: "apartment" } })).id;
    for (const u of ["201", "202", "203", "204"]) units[u] = (await m.prisma.unit.create({ data: { propertyId, unitNumber: u, rentAmount: 5000, status: "occupied" } })).id;
    units.plain = (await m.prisma.unit.create({ data: { propertyId: plainPropertyId, unitNumber: "P1", rentAmount: 4000, status: "occupied" } })).id;
    admin = { kind: "ADMIN", id: accountId, role: "LANDLORD", accountId };
    otherAdmin = { kind: "ADMIN", id: otherAccountId, role: "LANDLORD", accountId: otherAccountId };
    const ct = await m.prisma.user.create({ data: { accountId, email: `ops-care.${tag}@example.test`, password: "x", name: "Caretaker Ana", role: "CARETAKER" } });
    await m.prisma.caretakerProperty.create({ data: { userId: ct.id, propertyId } });
    caretaker = { kind: "CARETAKER", id: ct.id, role: "CARETAKER", accountId };
    const ct2 = await m.prisma.user.create({ data: { accountId, email: `ops-care2.${tag}@example.test`, password: "x", name: "Other caretaker", role: "CARETAKER" } });
    await m.prisma.caretakerProperty.create({ data: { userId: ct2.id, propertyId: plainPropertyId } });
    strangerCaretaker = { kind: "CARETAKER", id: ct2.id, role: "CARETAKER", accountId };

    await m.profile.upsertProfile(admin, propertyId, { enabled: true, waterEnabled: true, paymentInstructions: "GCash 0917-000-0000" });
    for (const u of ["201", "202", "203", "204"]) {
      await m.rooms.addRecurringCharge(admin, units[u], { type: "RENT", description: "Room rent", amountCentavos: 500000, amountBasis: "PER_CYCLE", frequency: "EVERY_CYCLE", intervalMonths: 1, startMonth: "2026-10" });
    }
    await m.rooms.updateRoomSettings(admin, units["203"], { meterId: "M-203" });
    await makeTenant("a", "201");
    await makeTenant("b", "202");
    await makeTenant("c", "203");
    await makeTenant("plain", "plain");
  });

  after(async () => {
    await m?.prisma.$disconnect();
  });

  describe("Phase 1 follow-ups", () => {
    test("statement and receipt PDFs: only the account's admins and the tenant they belong to", async () => {
      await m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: new Date("2026-11-12T02:00:00Z") });
      const st = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.a, periodKey: "2026-11-A" } });
      await assert.rejects(m.documents.statementPdf(tenantActor("a"), st.id), /not found/i, "drafts are never served");
      await m.statements.publishStatement(admin, st.id);
      const adminPdf = await m.documents.statementPdf(admin, st.id);
      assert.equal(Buffer.from(adminPdf.bytes.subarray(0, 5)).toString(), "%PDF-");
      assert.match(adminPdf.fileName, /^SOA-202611-\d{5}\.pdf$/);
      await m.documents.statementPdf(tenantActor("a"), st.id);
      await assert.rejects(m.documents.statementPdf(tenantActor("b"), st.id), /not found/i);
      await assert.rejects(m.documents.statementPdf(otherAdmin, st.id), /not found/i);
      await assert.rejects(m.documents.statementPdf(caretaker, st.id), /not found/i);

      const { payment } = await m.payments.recordAdminPayment(admin, tenants.a, { amountCentavos: 200000, method: "cash", paidOn: "2026-11-15" });
      const r = await m.documents.receiptPdf(tenantActor("a"), payment.id);
      assert.equal(Buffer.from(r.bytes.subarray(0, 5)).toString(), "%PDF-");
      await assert.rejects(m.documents.receiptPdf(tenantActor("b"), payment.id), /not found/i);
      await assert.rejects(m.documents.receiptPdf(otherAdmin, payment.id), /not found/i);
    });

    test("receipt email: skipped without an address, and a failed send leaves it unclaimed for retry", async () => {
      const p = await m.prisma.rentPayment.findFirstOrThrow({ where: { tenantId: tenants.a, status: "APPROVED" } });
      assert.deepEqual(await m.documents.sendReceiptEmail(p.id), { sent: false, reason: "Tenant has no email" });
      await m.prisma.tenant.update({ where: { id: tenants.a }, data: { email: `a.${tag}@example.test` } });
      const res = await m.documents.sendReceiptEmail(p.id);
      assert.equal(res.sent, false, "no email provider in tests");
      assert.equal((await m.prisma.rentPayment.findUniqueOrThrow({ where: { id: p.id } })).receiptEmailedAt, null, "claim released after a failed send");
      await m.prisma.rentPayment.update({ where: { id: p.id }, data: { receiptEmailedAt: new Date() } });
      assert.deepEqual(await m.documents.sendReceiptEmail(p.id), { sent: false, reason: "Already sent" }, "never twice");
      await m.prisma.tenant.update({ where: { id: tenants.a }, data: { email: null } });
    });

    test("proration DAILY: a mid-cycle move-in pays only the days occupied; NONE bills in full", async () => {
      await makeTenant("late", "204", { moveIn: "2026-11-20" });
      await m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: new Date("2026-11-21T02:00:00Z") });
      const full = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.late, type: "RENT", periodKey: "2026-11-A" } });
      assert.equal(full.amountCentavos, 500000);
      const st = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.late, periodKey: "2026-11-A" } });
      await m.statements.discardDraft(admin, st.id);
      await m.profile.upsertProfile(admin, propertyId, { prorationPolicy: "DAILY" });
      await m.statements.generateStatements(admin, propertyId, "2026-11-A", { now: new Date("2026-11-21T02:00:00Z") });
      const pro = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.late, type: "RENT", periodKey: "2026-11-A" } });
      assert.equal(pro.amountCentavos, 333333, "10 of 15 days");
      assert.equal((pro.calc as { prorated: boolean }).prorated, true);
      const aRent = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.a, type: "RENT", periodKey: "2026-11-A" } });
      assert.equal(aRent.amountCentavos, 500000, "issued charges are never recalculated");
      await m.profile.upsertProfile(admin, propertyId, { prorationPolicy: "NONE" });
      for (const s of await m.prisma.statement.findMany({ where: { tenantId: tenants.late, status: "DRAFT" } })) await m.statements.discardDraft(admin, s.id);
      await m.prisma.tenant.update({ where: { id: tenants.late }, data: { isActive: false, moveOutDate: new Date("2026-11-20T00:00:00+08:00") } });
    });

    test("repeating penalties: capped, once per later cycle, rerun-safe, never compounding", async () => {
      await assert.rejects(m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: true, penaltyRateBps: 500, penaltyGraceDays: 0, penaltyRepeat: "EACH_CYCLE" }), /how many penalties/);
      await m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: true, penaltyRateBps: 500, penaltyGraceDays: 0, penaltyRepeat: "EACH_CYCLE", penaltyMaxRepeats: 2 });
      // Tenant b's Nov-A statement (₱5,000, due Nov 15) stays unpaid.
      const stB = await m.prisma.statement.findFirstOrThrow({ where: { tenantId: tenants.b, periodKey: "2026-11-A" } });
      await m.statements.publishStatement(admin, stB.id);
      const pens = () => m.prisma.charge.findMany({ where: { tenantId: tenants.b, type: "PENALTY", sourceId: stB.id }, orderBy: { createdAt: "asc" } });
      for (const [period, now] of [["2026-11-B", "2026-11-27"], ["2026-11-B", "2026-11-28"], ["2026-12-A", "2026-12-12"], ["2026-12-B", "2026-12-27"]] as const) {
        await m.statements.generateStatements(admin, propertyId, period, { now: new Date(`${now}T02:00:00Z`) });
        const d = await m.prisma.statement.findFirst({ where: { tenantId: tenants.b, periodKey: period, status: "DRAFT" } });
        if (d && period !== "2026-11-B") await m.statements.publishStatement(admin, d.id);
        if (d && period === "2026-11-B" && now === "2026-11-28") await m.statements.publishStatement(admin, d.id);
      }
      const list = await pens();
      assert.equal(list.length, 2, "two penalties for one statement, the cap");
      assert.deepEqual(list.map((p) => p.amountCentavos), [26750, 26750], "5% of the original ₱5,350 (rent + water) each time — never of earlier penalties");
      assert.equal(list[0].sourceKey, `penalty:${stB.id}`);
      assert.equal(list[1].sourceKey, `penalty:${stB.id}:2026-12-A`);
      await m.profile.upsertProfile(admin, propertyId, { penaltyEnabled: false, penaltyRepeat: "ONCE" });
    });
  });

  describe("Household (occupants)", () => {
    test("max 4 at a time, even with simultaneous adds; moved-out people free a place", async () => {
      const results = await Promise.allSettled(["P1", "P2", "P3", "P4", "P5"].map((n, i) => m.occupants.addOccupant(admin, tenants.c, { name: `Person ${n}`, isPrimary: i === 0 ? true : undefined })));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 4);
      assert.equal(await m.prisma.occupant.count({ where: { tenantId: tenants.c, movedOutOn: null } }), 4);
      const one = await m.prisma.occupant.findFirstOrThrow({ where: { tenantId: tenants.c, isPrimary: false } });
      await m.occupants.moveOutOccupant(admin, one.id, "2026-12-01");
      await m.occupants.addOccupant(admin, tenants.c, { name: "Replacement" });
      await assert.rejects(m.occupants.addOccupant(admin, tenants.c, { name: "Too many" }), /at most 4/);
    });

    test("household changes never change the water bill silently; the office sees a mismatch", async () => {
      const v = await m.occupants.householdAdminView(admin, tenants.c);
      assert.equal(v.activeCount, 4);
      assert.equal(v.billingCount, 1);
      assert.equal(v.mismatch, true);
      assert.equal((await m.prisma.tenant.findUniqueOrThrow({ where: { id: tenants.c } })).occupantCount, 1);
    });

    test("IDs are office-only: tenants, caretakers and other accounts can't open them; tenants see names only", async () => {
      const occ = await m.prisma.occupant.findFirstOrThrow({ where: { tenantId: tenants.c, isPrimary: true } });
      const saved = await m.occupants.attachOccupantFile(admin, occ.id, "id", png("id.png"));
      const file = await m.prisma.storedFile.findUniqueOrThrow({ where: { id: saved.idFileId! } });
      assert.equal(file.purpose, "OCCUPANT_ID");
      assert.equal(await m.files.canReadFileAsync(admin, file), true);
      assert.equal(await m.files.canReadFileAsync(tenantActor("c"), file), false, "not even the tenant it belongs to");
      assert.equal(await m.files.canReadFileAsync(caretaker, file), false);
      assert.equal(await m.files.canReadFileAsync(otherAdmin, file), false);
      const view = await m.occupants.householdTenantView(tenantActor("c"));
      assert.ok(view.length === 4 && view.every((o) => !("idFileId" in o) && !("notes" in o) && !("phone" in o)));
      await assert.rejects(m.occupants.addOccupant(otherAdmin, tenants.c, { name: "x" }), /not found/i);
      await assert.rejects(m.occupants.addOccupant(caretaker, tenants.c, { name: "x" }), /access/i);
    });
  });

  describe("Checklists", () => {
    test("start is idempotent (also concurrently); later template edits don't rewrite existing checklists", async () => {
      await m.checklists.saveTemplate(admin, { propertyId, kind: "MOVE_IN", items: "* Keys handed over\nHouse rules explained" });
      const [x, y] = await Promise.all([m.checklists.startChecklist(admin, tenants.a, "MOVE_IN"), m.checklists.startChecklist(admin, tenants.a, "MOVE_IN")]);
      assert.equal(x.id, y.id);
      await m.checklists.saveTemplate(admin, { propertyId, kind: "MOVE_IN", items: "* Something new" });
      const cl = (await m.checklists.checklistsFor(tenants.a)).find((c) => c.kind === "MOVE_IN")!;
      assert.deepEqual(cl.items.map((i) => i.label), ["Keys handed over", "House rules explained"]);
    });

    test("required items block completion; completed checklists are locked until reopened with a reason", async () => {
      const cl = (await m.checklists.checklistsFor(tenants.a)).find((c) => c.kind === "MOVE_IN")!;
      await assert.rejects(m.checklists.completeChecklist(admin, cl.id), /Keys handed over/);
      const keys = cl.items.find((i) => i.required)!;
      await m.checklists.setItem(admin, keys.id, { done: true, note: "2 keys + gate card" });
      await m.checklists.completeChecklist(admin, cl.id);
      await assert.rejects(m.checklists.setItem(admin, keys.id, { done: false }), /completed/);
      await assert.rejects(m.checklists.reopenChecklist(admin, cl.id, ""), /Reason/);
      await m.checklists.reopenChecklist(admin, cl.id, "Missed the meter photo");
      await assert.rejects(m.checklists.setItem(otherAdmin, keys.id, { done: false }), /not found/i);
    });
  });

  describe("Deposits and advance rent", () => {
    test("held money isn't rent: receiving it doesn't touch the ledger", async () => {
      const before = (await balance("b")).outstandingCentavos;
      await m.deposits.receiveDeposit(admin, tenants.b, { fund: "SECURITY_DEPOSIT", amountCentavos: 1000000, occurredOn: "2026-10-01", method: "cash" });
      await m.deposits.receiveDeposit(admin, tenants.b, { fund: "ADVANCE_RENT", amountCentavos: 500000, occurredOn: "2026-10-01", method: "cash" });
      assert.equal((await balance("b")).outstandingCentavos, before);
      const s = await m.deposits.depositSummary(tenants.b);
      assert.deepEqual(s.balances, { SECURITY_DEPOSIT: 1000000, ADVANCE_RENT: 500000 });
    });

    test("applying: never more than held or owed; concurrent applies can't overdraw; payment is marked as deposit", async () => {
      const owed = (await balance("b")).outstandingCentavos;
      assert.ok(owed > 500000);
      await assert.rejects(m.deposits.applyDepositToCharges(admin, tenants.b, { fund: "ADVANCE_RENT", amountCentavos: 600000, reason: "x" }), /Only/);
      const tries = await Promise.allSettled([1, 2, 3].map(() => m.deposits.applyDepositToCharges(admin, tenants.b, { fund: "ADVANCE_RENT", amountCentavos: 300000, reason: "Advance rent" })));
      assert.equal(tries.filter((t) => t.status === "fulfilled").length, 1, "₱5,000 held covers one ₱3,000 application");
      const s = await m.deposits.depositSummary(tenants.b);
      assert.equal(s.balances.ADVANCE_RENT, 200000);
      assert.equal((await balance("b")).outstandingCentavos, owed - 300000);
      const pay = await m.prisma.rentPayment.findFirstOrThrow({ where: { tenantId: tenants.b, method: "advance_rent" } });
      assert.equal(pay.status, "APPROVED");
      await assert.rejects(m.payments.reversePayment(admin, pay.id, "oops"), /deposit ledger/);
    });

    test("undoing an application restores both the fund and the debt, once", async () => {
      const owed = (await balance("b")).outstandingCentavos;
      const applied = await m.prisma.depositTransaction.findFirstOrThrow({ where: { tenantId: tenants.b, kind: "APPLIED" } });
      const [r1, r2] = await Promise.all([m.deposits.reverseDepositTransaction(admin, applied.id, "Wrong fund"), m.deposits.reverseDepositTransaction(admin, applied.id, "Wrong fund")]);
      assert.ok([r1.alreadyReversed, r2.alreadyReversed].filter(Boolean).length === 1);
      assert.equal((await m.deposits.depositSummary(tenants.b)).balances.ADVANCE_RENT, 500000);
      assert.equal((await balance("b")).outstandingCentavos, owed + 300000);
      assert.equal((await m.prisma.rentPayment.findUniqueOrThrow({ where: { id: applied.paymentId! } })).status, "REVERSED");
    });

    test("refund / forfeit can't exceed what's held; a receipt can't be undone once spent", async () => {
      await assert.rejects(m.deposits.releaseDeposit(admin, tenants.b, { fund: "SECURITY_DEPOSIT", kind: "REFUNDED", amountCentavos: 1000001, occurredOn: "2027-01-05", reason: "x" }), /Only/);
      await m.deposits.applyDepositToCharges(admin, tenants.b, { fund: "SECURITY_DEPOSIT", amountCentavos: 100000, reason: "test" });
      const received = await m.prisma.depositTransaction.findFirstOrThrow({ where: { tenantId: tenants.b, fund: "SECURITY_DEPOSIT", kind: "RECEIVED" } });
      await assert.rejects(m.deposits.reverseDepositTransaction(admin, received.id, "typo"), /already been applied/);
      await assert.rejects(m.deposits.receiveDeposit(otherAdmin, tenants.b, { fund: "SECURITY_DEPOSIT", amountCentavos: 1, occurredOn: "2026-10-01" }), /not found/i);
    });
  });

  describe("Leases", () => {
    test("terms can't overlap; renewal starts the next day and only once", async () => {
      const t1 = await m.leases.addLeaseTerm(admin, tenants.a, { startDate: "2026-10-01", endDate: "2027-03-31", monthlyRentCentavos: 1000000 });
      await assert.rejects(m.leases.addLeaseTerm(admin, tenants.a, { startDate: "2027-03-01", endDate: "2027-09-30" }), /overlaps/);
      const t2 = await m.leases.renewLease(admin, t1.id, { endDate: "2028-03-31" });
      assert.equal(t2.startDate.toISOString().slice(0, 10), "2027-04-01");
      assert.equal(t2.monthlyRentCentavos, 1000000, "rent carried over when not changed");
      await assert.rejects(m.leases.renewLease(admin, t1.id, { endDate: "2028-03-31" }), /already been renewed/);
      const exp = await m.leases.expiringLeases(accountId, propertyId, 60);
      assert.ok(!exp.some((t) => t.id === t1.id), "a renewed term isn't 'ending'");
    });

    test("print → sign → upload: tenants upload only signed copies of their own lease; files stay private", async () => {
      const own = await m.leases.uploadLeaseDocument(admin, { tenantId: tenants.a, kind: "OWNER_LEASE", file: pdf() });
      await assert.rejects(m.leases.uploadLeaseDocument(tenantActor("a"), { kind: "OWNER_LEASE", file: pdf() }), /access/i);
      const signed = await m.leases.uploadLeaseDocument(tenantActor("a"), { kind: "SIGNED_COPY", file: pdf() });
      assert.equal(signed.uploadedByRole, "TENANT");
      const file = await m.prisma.storedFile.findUniqueOrThrow({ where: { id: own.fileId } });
      assert.equal(await m.files.canReadFileAsync(tenantActor("a"), file), true);
      assert.equal(await m.files.canReadFileAsync(tenantActor("b"), file), false);
      assert.equal(await m.files.canReadFileAsync(caretaker, file), false);
      // A property without the Dawson features keeps its tenant portal as before.
      const plainTenant: Actor = { kind: "TENANT", id: tenants.plain, role: "TENANT", accountId, tenantId: tenants.plain };
      await assert.rejects(m.leases.uploadLeaseDocument(plainTenant, { kind: "SIGNED_COPY", file: pdf() }), /access/i);
    });
  });

  describe("Move-out", () => {
    test("vacancy is refused until checklist, deposit and final reading are settled", async () => {
      await m.deposits.receiveDeposit(admin, tenants.c, { fund: "SECURITY_DEPOSIT", amountCentavos: 1000000, occurredOn: "2026-10-01" });
      const mo = await m.moveout.startMoveOut(admin, tenants.c, { plannedDate: "2027-02-28", noticeDate: "2027-01-28" });
      const again = await m.moveout.startMoveOut(admin, tenants.c, { plannedDate: "2027-02-28" });
      assert.equal(again.id, mo.id);
      await assert.rejects(m.moveout.approveVacancy(admin, mo.id, { actualDate: "2027-02-28" }), /Not ready yet/);
      const v = await m.moveout.moveOutView(admin, mo.id);
      assert.deepEqual(v.checks.map((c) => c.ok), [false, false, true, false], "checklist, deposit and meter pending; advance rent is zero");
    });

    test("damages post to the ledger once per submit; the deposit pays them; the rest is refunded", async () => {
      const mo = await m.prisma.moveOut.findUniqueOrThrow({ where: { tenantId: tenants.c } });
      const before = (await balance("c")).outstandingCentavos;
      const [d1, d2] = await Promise.all([
        m.moveout.addDamageCharge(admin, mo.id, { description: "Broken window", amountCentavos: 150000, clientRequestId: "req-dmg-0001" }),
        m.moveout.addDamageCharge(admin, mo.id, { description: "Broken window", amountCentavos: 150000, clientRequestId: "req-dmg-0001" }),
      ]).catch(async () => {
        const c = await m.prisma.charge.findFirstOrThrow({ where: { tenantId: tenants.c, type: "DAMAGE" } });
        return [c, c];
      });
      assert.equal(d1.id, d2.id);
      assert.equal((await balance("c")).outstandingCentavos, before + 150000);
      const owed = (await balance("c")).outstandingCentavos;
      await m.deposits.applyDepositToCharges(admin, tenants.c, { fund: "SECURITY_DEPOSIT", amountCentavos: Math.min(owed, 1000000), reason: "Final settlement" });
      const left = (await m.deposits.depositSummary(tenants.c)).balances.SECURITY_DEPOSIT;
      if (left > 0) await m.deposits.releaseDeposit(admin, tenants.c, { fund: "SECURITY_DEPOSIT", kind: "REFUNDED", amountCentavos: left, occurredOn: "2027-02-28", reason: "Balance of deposit returned" });
      assert.equal((await m.deposits.depositSummary(tenants.c)).balances.SECURITY_DEPOSIT, 0);
    });

    test("approving the vacancy ends the tenancy, moves out the household and frees the room", async () => {
      const mo = await m.prisma.moveOut.findUniqueOrThrow({ where: { tenantId: tenants.c } });
      await m.moveout.recordInspection(admin, mo.id, { notes: "Window cracked; otherwise clean" });
      await m.moveout.recordFinalReading(admin, mo.id, { value: "120.5", readingDate: "2027-02-28" });
      const cl = (await m.checklists.checklistsFor(tenants.c)).find((c) => c.kind === "MOVE_OUT")!;
      for (const i of cl.items.filter((x) => x.required)) await m.checklists.setItem(admin, i.id, { done: true });
      const owed = (await balance("c")).outstandingCentavos;
      if (owed > 0) await assert.rejects(m.moveout.approveVacancy(admin, mo.id, { actualDate: "2027-02-28" }), /still owes/);
      const done = await m.moveout.approveVacancy(admin, mo.id, { actualDate: "2027-02-28", outstandingNote: owed > 0 ? "Tenant will pay by Mar 15" : undefined });
      assert.equal(done.status, "COMPLETED");
      const t = await m.prisma.tenant.findUniqueOrThrow({ where: { id: tenants.c } });
      assert.equal(t.isActive, false);
      assert.equal(t.moveOutDate!.toISOString().slice(0, 10), "2027-02-28");
      assert.equal(await m.prisma.occupant.count({ where: { tenantId: tenants.c, movedOutOn: null } }), 0);
      assert.equal((await m.prisma.unit.findUniqueOrThrow({ where: { id: units["203"] } })).status, "vacant");
      await assert.rejects(m.moveout.approveVacancy(admin, mo.id, { actualDate: "2027-02-28" }), /already completed/);
      const gen = await m.statements.generateStatements(admin, propertyId, "2027-03-B", { now: new Date("2027-03-01T02:00:00Z") });
      assert.ok(!gen.results.some((r) => r.tenantId === tenants.c), "no statements after the move-out");
    });
  });

  describe("Maintenance and work orders", () => {
    let requestId: string;
    test("tenant request → office assigns → only the assigned caretaker sees it", async () => {
      const req = await m.maintenance.createTenantRequest(tenantActor("a"), { title: "Leaking faucet", description: "Bathroom sink drips", priority: "high" });
      requestId = req.id;
      assert.equal(req.status, "SUBMITTED");
      assert.equal(req.propertyId, propertyId);
      await assert.rejects(m.maintenance.requestDetail(caretaker, req.id), /not found/i, "unassigned work isn't visible to caretakers");
      await m.maintenance.assignRequest(admin, req.id, caretaker.id);
      const d = await m.maintenance.requestDetail(caretaker, req.id);
      assert.equal(d.request.status, "ASSIGNED");
      assert.equal(d.tenant, null, "caretakers never get tenant identity or contact details");
      await assert.rejects(m.maintenance.requestDetail(strangerCaretaker, req.id), /not found/i);
      await assert.rejects(m.maintenance.assignRequest(admin, req.id, strangerCaretaker.id), /isn't assigned to this property/);
      await assert.rejects(m.maintenance.requestDetail(otherAdmin, req.id), /not found/i);
      await assert.rejects(m.maintenance.requestDetail(tenantActor("b"), req.id), /not found/i);
    });

    test("caretaker moves are limited; simultaneous moves can't both win; tenants see only visible updates", async () => {
      await assert.rejects(m.maintenance.updateRequest(caretaker, requestId, { status: "CLOSED" }), /Can't move/);
      const both = await Promise.allSettled([m.maintenance.updateRequest(caretaker, requestId, { status: "IN_PROGRESS", note: "On it" }), m.maintenance.updateRequest(caretaker, requestId, { status: "WAITING", note: "Need parts" })]);
      assert.equal(both.filter((b) => b.status === "fulfilled").length, 1);
      await m.maintenance.updateRequest(admin, requestId, { note: "Internal: buy a washer", visibleToTenant: false });
      await m.maintenance.updateRequest(admin, requestId, { note: "Caretaker will come tomorrow" });
      const t = await m.maintenance.requestDetail(tenantActor("a"), requestId);
      assert.ok(t.updates.some((u) => u.note === "Caretaker will come tomorrow"));
      assert.ok(!t.updates.some((u) => u.note?.startsWith("Internal")), "internal notes hidden from the tenant");
      assert.ok(!t.updates.some((u) => u.role === "CARETAKER"), "caretaker work notes stay with the office");
      await assert.rejects(m.maintenance.updateRequest(tenantActor("a"), requestId, { status: "COMPLETED" }), /access/i);
    });

    test("photos: private, readable by the office, the tenant and the property's caretakers only", async () => {
      const u = await m.maintenance.addPhoto(tenantActor("a"), requestId, png());
      const file = await m.prisma.storedFile.findUniqueOrThrow({ where: { id: (u.photoFileIds as string[])[0] } });
      assert.equal(await m.files.canReadFileAsync(admin, file), true);
      assert.equal(await m.files.canReadFileAsync(tenantActor("a"), file), true);
      assert.equal(await m.files.canReadFileAsync(caretaker, file), true);
      assert.equal(await m.files.canReadFileAsync(strangerCaretaker, file), false);
      assert.equal(await m.files.canReadFileAsync(tenantActor("b"), file), false);
    });

    test("legacy requests (open / resolved) are listed with the new statuses and left unchanged", async () => {
      const legacy = await m.prisma.maintenanceRequest.create({ data: { tenantId: tenants.b, title: "Old request", description: "From before", status: "open" } });
      const list = await m.maintenance.listRequests(admin, { propertyId, status: "open" });
      const row = list.find((r) => r.id === legacy.id);
      assert.equal(row?.status, "SUBMITTED");
      assert.equal((await m.prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: legacy.id } })).status, "open");
      const common = await m.maintenance.createAdminRequest(admin, { propertyId, title: "Hallway light", description: "2nd floor", assignedToId: caretaker.id });
      assert.equal(common.tenantId, null);
      assert.ok((await m.maintenance.listRequests(caretaker)).some((r) => r.id === common.id));
    });
  });

  describe("Messages and announcements", () => {
    test("private threads: tenant ↔ office only; unread tracking; other tenants and caretakers can't read", async () => {
      const t = await m.messages.startThread(tenantActor("a"), { subject: "Question", body: "Can I pay on the 16th?" });
      assert.equal((await m.messages.listThreads(admin)).find((x) => x.id === t.id)?.unread, true);
      await m.messages.threadDetail(admin, t.id);
      assert.equal((await m.messages.listThreads(admin)).find((x) => x.id === t.id)?.unread, false);
      await m.messages.reply(admin, t.id, { body: "Yes, that's fine." });
      assert.equal((await m.messages.listThreads(tenantActor("a"))).find((x) => x.id === t.id)?.unread, true);
      await assert.rejects(m.messages.threadDetail(tenantActor("b"), t.id), /not found/i);
      await assert.rejects(m.messages.threadDetail(caretaker, t.id), /access/i);
      await assert.rejects(m.messages.threadDetail(otherAdmin, t.id), /not found/i);
      const plainTenant: Actor = { kind: "TENANT", id: tenants.plain, role: "TENANT", accountId, tenantId: tenants.plain };
      await assert.rejects(m.messages.startThread(plainTenant, { subject: "x", body: "y" }), /access/i);
    });

    test("announcements reach only that property's tenants; account-wide notices still reach everyone", async () => {
      await m.announcements.postAnnouncement(admin, { propertyId, title: `Water off ${tag}`, content: "Saturday 9–12" });
      await m.prisma.notice.create({ data: { accountId, title: `Account-wide ${tag}`, content: "Hello" } });
      const see = async (key: string, pid: string) => (await m.prisma.notice.findMany({ where: m.announcements.tenantNoticeWhere(accountId, tenants[key], pid) })).map((n) => n.title);
      assert.ok((await see("a", propertyId)).includes(`Water off ${tag}`));
      assert.ok(!(await see("plain", plainPropertyId)).includes(`Water off ${tag}`));
      assert.ok((await see("plain", plainPropertyId)).includes(`Account-wide ${tag}`));
      await assert.rejects(m.announcements.postAnnouncement(otherAdmin, { propertyId, title: "x", content: "y" }), /not found/i);
    });

    test("operations summary counts occupancy, open work and unread messages", async () => {
      const s = await m.summary.operationsSummary(admin, propertyId);
      assert.equal(s.occupancy.rooms, 4);
      assert.equal(s.occupancy.occupied, 2, "a and b; c moved out; 204's tenancy ended");
      assert.ok(s.maintenance.open >= 2);
      await assert.rejects(m.summary.operationsSummary(otherAdmin, propertyId), /not found/i);
    });
  });
}
