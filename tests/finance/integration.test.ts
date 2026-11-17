// Database-backed tests for Phase 3: expenses, petty cash, utility bills,
// building meters and reports. Same setup as the other integration tests:
//
//   TEST_DATABASE_URL=postgresql://... npm run test:integration

import { before, after, describe, test } from "node:test";
import assert from "node:assert/strict";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test("finance integration tests skipped (set TEST_DATABASE_URL)", { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = url;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.RESEND_API_KEY;
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
    files: typeof import("@/lib/collections/files");
    deposits: typeof import("@/lib/operations/deposits");
    expenses: typeof import("@/lib/finance/expenses");
    petty: typeof import("@/lib/finance/pettycash");
    utilities: typeof import("@/lib/finance/utilities");
    reports: typeof import("@/lib/finance/reports");
  };
  const tag = `f${Date.now().toString(36)}`;
  let accountId: string, propertyId: string, otherPropertyId: string;
  const units: Record<string, string> = {};
  const tenants: Record<string, string> = {};
  let admin: Actor, otherAdmin: Actor, caretaker: Actor, strangerCaretaker: Actor;
  const tenantActor = (k: string): Actor => ({ kind: "TENANT", id: tenants[k], role: "TENANT", accountId, tenantId: tenants[k] });
  const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 24 }, () => Math.floor(Math.random() * 256))])], "r.png", { type: "image/png" });
  const pc = () => m.petty.pettyCashView(admin, propertyId).then((v) => v.balanceCentavos);

  before(async () => {
    m = {
      prisma: (await import("@/lib/prisma")).prisma,
      profile: await import("@/lib/collections/profile"),
      rooms: await import("@/lib/collections/rooms"),
      statements: await import("@/lib/collections/statements"),
      payments: await import("@/lib/collections/payments"),
      files: await import("@/lib/collections/files"),
      deposits: await import("@/lib/operations/deposits"),
      expenses: await import("@/lib/finance/expenses"),
      petty: await import("@/lib/finance/pettycash"),
      utilities: await import("@/lib/finance/utilities"),
      reports: await import("@/lib/finance/reports"),
    };
    (await import("@/lib/collections/clock")).setClockForTests(new Date("2027-03-01T02:00:00Z"));
    const plan = await m.prisma.plan.create({ data: { name: `Fin ${tag}`, price: 499, maxUnits: 100, maxTenants: 100, maxProperties: 10, features: [] } });
    const acct = await m.prisma.account.create({ data: { name: `Dawson fin ${tag}`, ownerName: "Byron Test", email: `fin.${tag}@example.test`, password: "x", planId: plan.id } });
    const other = await m.prisma.account.create({ data: { name: `Other fin ${tag}`, ownerName: "Other", email: `fin-other.${tag}@example.test`, password: "x", planId: plan.id } });
    accountId = acct.id;
    propertyId = (await m.prisma.property.create({ data: { accountId, name: "Dawson Residences (finance test)", address: "Consolacion, Cebu", type: "apartment" } })).id;
    otherPropertyId = (await m.prisma.property.create({ data: { accountId, name: "Second property", address: "Elsewhere", type: "apartment" } })).id;
    for (const u of ["301", "302", "303", "304"]) units[u] = (await m.prisma.unit.create({ data: { propertyId, unitNumber: u, rentAmount: 5000, status: "occupied" } })).id;
    admin = { kind: "ADMIN", id: accountId, role: "LANDLORD", accountId };
    otherAdmin = { kind: "ADMIN", id: other.id, role: "LANDLORD", accountId: other.id };
    const ct = await m.prisma.user.create({ data: { accountId, email: `fin-care.${tag}@example.test`, password: "x", name: "Caretaker", role: "CARETAKER" } });
    await m.prisma.caretakerProperty.create({ data: { userId: ct.id, propertyId } });
    caretaker = { kind: "CARETAKER", id: ct.id, role: "CARETAKER", accountId };
    const ct2 = await m.prisma.user.create({ data: { accountId, email: `fin-care2.${tag}@example.test`, password: "x", name: "Other caretaker", role: "CARETAKER" } });
    await m.prisma.caretakerProperty.create({ data: { userId: ct2.id, propertyId: otherPropertyId } });
    strangerCaretaker = { kind: "CARETAKER", id: ct2.id, role: "CARETAKER", accountId };

    await m.profile.upsertProfile(admin, propertyId, { enabled: true, waterEnabled: true });
    for (const u of ["301", "302", "303"]) await m.rooms.addRecurringCharge(admin, units[u], { type: "RENT", description: "Room rent", amountCentavos: 500000, amountBasis: "PER_CYCLE", frequency: "EVERY_CYCLE", intervalMonths: 1, startMonth: "2027-01" });
    for (const [k, u, moveIn] of [["a", "301", "2027-01-01"], ["b", "302", "2027-01-01"], ["c", "303", "2027-02-01"]] as const) {
      tenants[k] = (await m.prisma.tenant.create({ data: { unitId: units[u], name: `Tenant ${k}`, phone: `+63919${tag}${k}`.slice(0, 30), moveInDate: new Date(`${moveIn}T00:00:00+08:00`), portalPin: "$2a$10$x", occupantCount: 1 } })).id;
    }
  });

  after(async () => {
    await m?.prisma.$disconnect();
  });

  describe("Expenses", () => {
    test("recorded with validation; office-only receipts; never deleted, voided with a reason once", async () => {
      await assert.rejects(m.expenses.recordExpense(admin, { propertyId, category: "SUPPLIES", description: "x", amount: "0", incurredOn: "2027-02-10" }), /more than zero/);
      await assert.rejects(m.expenses.recordExpense(admin, { propertyId, category: "SUPPLIES", description: "x", amount: "10", incurredOn: "2027-05-10" }), /future/);
      await assert.rejects(m.expenses.recordExpense(admin, { propertyId, category: "SUPPLIES", description: "x", amount: "10", incurredOn: "2027-02-10", method: "petty_cash" }), /Petty cash page/);
      await assert.rejects(m.expenses.recordExpense(admin, { propertyId, category: "BRIBES", description: "x", amount: "10", incurredOn: "2027-02-10" }), /category/);
      const e = await m.expenses.recordExpense(admin, { propertyId, category: "REPAIRS_MAINTENANCE", description: "Plumber, room 301", amount: "1,500.50", incurredOn: "2027-02-10", paidOn: "2027-02-10", method: "cash", unitId: units["301"] }, png());
      assert.equal(e.amountCentavos, 150050);
      const file = await m.prisma.storedFile.findUniqueOrThrow({ where: { id: e.receiptFileId! } });
      assert.equal(file.purpose, "EXPENSE_RECEIPT");
      assert.equal(await m.files.canReadFileAsync(admin, file), true);
      assert.equal(await m.files.canReadFileAsync(tenantActor("a"), file), false);
      assert.equal(await m.files.canReadFileAsync(caretaker, file), false);
      await assert.rejects(m.expenses.recordExpense(otherAdmin, { propertyId, category: "SUPPLIES", description: "x", amount: "10", incurredOn: "2027-02-10" }), /not found/i);
      await assert.rejects(m.expenses.recordExpense(caretaker, { propertyId, category: "SUPPLIES", description: "x", amount: "10", incurredOn: "2027-02-10" }), /access/i);
      const v = await m.expenses.recordExpense(admin, { propertyId, category: "SUPPLIES", description: "Typo entry", amount: "999", incurredOn: "2027-02-11" });
      await assert.rejects(m.expenses.voidExpense(admin, v.id, ""), /Reason/);
      const [x, y] = await Promise.allSettled([m.expenses.voidExpense(admin, v.id, "Duplicate"), m.expenses.voidExpense(admin, v.id, "Duplicate")]);
      assert.equal([x, y].filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await m.prisma.expense.findUniqueOrThrow({ where: { id: v.id } })).status, "VOID");
      const unpaid = await m.expenses.recordExpense(admin, { propertyId, category: "CLEANING", description: "Cleaner, February", amount: "2000", incurredOn: "2027-02-20" });
      await m.expenses.markExpensePaid(admin, unpaid.id, { paidOn: "2027-03-01", method: "gcash" });
      await assert.rejects(m.expenses.markExpensePaid(admin, unpaid.id, { paidOn: "2027-03-01" }), /Already/);
    });
  });

  describe("Petty cash", () => {
    test("top-up, spending creates the matching expense, balance can't go negative even under concurrency", async () => {
      await m.petty.topUp(admin, { propertyId, amountCentavos: 100000, occurredOn: "2027-02-01", description: "From bank" });
      const { expense } = await m.petty.disburse(admin, { propertyId, category: "SUPPLIES", description: "Light bulbs", amount: "300", incurredOn: "2027-02-05" }, png());
      assert.equal(expense.method, "petty_cash");
      assert.equal(expense.source, "PETTY_CASH");
      assert.equal(await pc(), 70000);
      const tries = await Promise.allSettled([1, 2, 3].map(() => m.petty.disburse(admin, { propertyId, category: "SUPPLIES", description: "Mop", amount: "400", incurredOn: "2027-02-06" })));
      assert.equal(tries.filter((t) => t.status === "fulfilled").length, 1, "₱700 covers only one ₱400 spend");
      assert.equal(await pc(), 30000);
      assert.equal(await m.prisma.expense.count({ where: { propertyId, source: "PETTY_CASH", status: "RECORDED" } }), 2);
    });

    test("petty-cash expenses are corrected through petty cash; undo restores cash and voids the expense once", async () => {
      const row = await m.prisma.pettyCashTransaction.findFirstOrThrow({ where: { propertyId, kind: "DISBURSEMENT", description: "Mop" } });
      await assert.rejects(m.expenses.voidExpense(admin, row.expenseId!, "x"), /Petty cash page/);
      const [r1, r2] = await Promise.all([m.petty.reversePettyCash(admin, row.id, "Wrong amount"), m.petty.reversePettyCash(admin, row.id, "Wrong amount")]);
      assert.equal([r1.alreadyReversed, r2.alreadyReversed].filter(Boolean).length, 1);
      assert.equal(await pc(), 70000);
      assert.equal((await m.prisma.expense.findUniqueOrThrow({ where: { id: row.expenseId! } })).status, "VOID");
      await m.petty.disburse(admin, { propertyId, category: "CLEANING", description: "Detergent", amount: "650", incurredOn: "2027-02-07" });
      const top = await m.prisma.pettyCashTransaction.findFirstOrThrow({ where: { propertyId, kind: "TOP_UP" } });
      await assert.rejects(m.petty.reversePettyCash(admin, top.id, "x"), /negative/);
    });

    test("cash count records the difference with a reason; a matching count is refused", async () => {
      assert.equal(await pc(), 5000);
      await assert.rejects(m.petty.recordCount(admin, { propertyId, countedCentavos: 5000, occurredOn: "2027-02-28", reason: "Month-end" }), /matches/);
      const { differenceCentavos } = await m.petty.recordCount(admin, { propertyId, countedCentavos: 4000, occurredOn: "2027-02-28", reason: "Month-end count" });
      assert.equal(differenceCentavos, -1000);
      assert.equal(await pc(), 4000);
      await assert.rejects(m.petty.topUp(otherAdmin, { propertyId, amountCentavos: 1, occurredOn: "2027-02-01" }), /not found/i);
    });
  });

  describe("Utility bills and building meters", () => {
    test("one bill per month and type, even concurrently; paying records one expense; voiding it reopens the bill", async () => {
      const make = () => m.utilities.recordUtilityBill(admin, { propertyId, utility: "WATER", scope: "MASTER", billingMonth: "2027-02", amount: "4,200", consumption: "60.5" });
      const both = await Promise.allSettled([make(), make()]);
      assert.equal(both.filter((b) => b.status === "fulfilled").length, 1);
      const bill = await m.prisma.utilityBill.findFirstOrThrow({ where: { propertyId, utility: "WATER", billingMonth: "2027-02" } });
      await m.utilities.updateUtilityBill(admin, bill.id, { amountCentavos: 430000 });
      const pays = await Promise.all([m.utilities.payUtilityBill(admin, bill.id, { paidOn: "2027-02-25", method: "gcash" }), m.utilities.payUtilityBill(admin, bill.id, { paidOn: "2027-02-25", method: "gcash" })]);
      assert.equal(pays.filter((p) => p.alreadyPaid).length, 1);
      const exp = await m.prisma.expense.findMany({ where: { propertyId, source: "UTILITY_BILL", status: "RECORDED" } });
      assert.equal(exp.length, 1);
      assert.equal(exp[0].amountCentavos, 430000);
      assert.equal(exp[0].category, "UTILITIES_WATER");
      await assert.rejects(m.utilities.updateUtilityBill(admin, bill.id, { amountCentavos: 1 }), /paid/);
      await assert.rejects(m.utilities.voidUtilityBill(admin, bill.id, "x"), /paid/);
      await m.expenses.voidExpense(admin, exp[0].id, "Paid from the wrong account");
      const reopened = await m.prisma.utilityBill.findUniqueOrThrow({ where: { id: bill.id } });
      assert.equal(reopened.status, "UNPAID");
      await m.utilities.payUtilityBill(admin, bill.id, { paidOn: "2027-02-26", method: "bank" });
      assert.equal(await m.prisma.expense.count({ where: { propertyId, source: "UTILITY_BILL", status: "RECORDED" } }), 1, "a second payment after a void works");
      await m.utilities.recordUtilityBill(admin, { propertyId, utility: "ELECTRICITY", scope: "COMMON_AREA", billingMonth: "2027-02", amount: "1,800" });
    });

    test("building meter rules: date order, no lower value unless reset; caretakers of the property may enter, never void", async () => {
      const add = (actor: Actor, value: string, readingDate: string, isMeterReset = false) => m.utilities.addMasterReading(actor, { propertyId, utility: "WATER", value, readingDate, isMeterReset });
      await add(admin, "1000", "2027-01-31");
      const r2 = await add(caretaker, "1062.5", "2027-02-28");
      assert.equal(r2.usage?.toString(), "62.5");
      await assert.rejects(add(admin, "1070", "2027-02-15"), /date order/);
      await assert.rejects(add(admin, "1050", "2027-03-01"), /lower than the last/);
      await assert.rejects(add(strangerCaretaker, "1070", "2027-03-01"), /not found/i);
      await assert.rejects(add(tenantActor("a"), "1070", "2027-03-01"), /access/i);
      await assert.rejects(m.utilities.voidMasterReading(caretaker, r2.id, "x"), /access/i);
      const first = await m.prisma.masterMeterReading.findFirstOrThrow({ where: { propertyId, value: 1000 } });
      await assert.rejects(m.utilities.voidMasterReading(admin, first.id, "x"), /most recent/);
      const reset = await add(admin, "5", "2027-03-01", true);
      assert.equal(reset.usage, null);
    });
  });

  describe("Reports", () => {
    before(async () => {
      // Two cycles of February billing, published; payments and deposits.
      for (const [period, now] of [["2027-02-A", "2027-02-12"], ["2027-02-B", "2027-02-27"]] as const) {
        await m.statements.generateStatements(admin, propertyId, period, { now: new Date(`${now}T02:00:00Z`) });
        for (const s of await m.prisma.statement.findMany({ where: { propertyId, periodKey: period, status: "DRAFT" } })) await m.statements.publishStatement(admin, s.id);
      }
      await m.payments.recordAdminPayment(admin, tenants.a, { amountCentavos: 1035000, method: "cash", paidOn: "2027-02-20" }); // pays all of a's Feb
      await m.payments.recordAdminPayment(admin, tenants.b, { amountCentavos: 300000, method: "gcash", paidOn: "2027-02-21" }); // partial
      const pend = await m.payments.submitTenantPayment(tenantActor("c"), { amountCentavos: 999900, method: "gcash", paidOn: "2027-02-22", referenceNumber: `P${tag}`, clientRequestId: `req-${tag}-c1` }, png());
      assert.equal(pend.payment.status, "PENDING");
      await m.deposits.receiveDeposit(admin, tenants.b, { fund: "SECURITY_DEPOSIT", amountCentavos: 1000000, occurredOn: "2027-01-01" });
      await m.deposits.receiveDeposit(admin, tenants.b, { fund: "ADVANCE_RENT", amountCentavos: 500000, occurredOn: "2027-01-01" });
      await m.deposits.applyDepositToCharges(admin, tenants.b, { fund: "ADVANCE_RENT", amountCentavos: 200000, reason: "Advance applied" });
    });

    test("income: approved payments by date paid, split by what they paid; pending excluded; totals reconcile", async () => {
      const t = await m.reports.runReport(admin, "income", { propertyId, from: "2027-01", to: "2027-03" });
      const feb = t.rows.find((r) => r.month === "2027-02")!;
      assert.equal(feb.total, 1035000 + 300000, "pending ₱9,999 from tenant c excluded");
      const parts = ["rent", "water", "internet", "parking", "penalties", "damages", "other", "credit"].reduce((s, k) => s + Number(feb[k] ?? 0), 0);
      assert.equal(parts, feb.total, "categories + credit = total collected");
      const mar = t.rows.find((r) => r.month === "2027-03")!;
      assert.equal(mar.total, 200000, "advance rent counts as income when applied (Mar 1)");
      const approvedSum = (await m.prisma.rentPayment.aggregate({ where: { propertyId, status: "APPROVED" }, _sum: { amountCentavos: true } }))._sum.amountCentavos;
      assert.equal(t.totals!.total, approvedSum);
    });

    test("collections and receivables agree with the ledger", async () => {
      const posted = await m.prisma.charge.aggregate({ where: { propertyId, status: "POSTED", billingMonth: "2027-02" }, _sum: { amountCentavos: true } });
      const c = await m.reports.runReport(admin, "collections", { propertyId, from: "2027-02", to: "2027-02" });
      const feb = c.rows[0];
      assert.equal(feb.billed, posted._sum.amountCentavos);
      assert.equal(feb.collected, 1035000 + 300000 + 200000);
      assert.equal((feb.net as number) - (feb.collected as number), feb.outstanding);
      const r = await m.reports.runReport(admin, "receivables", { propertyId, asOf: "2027-03-01" });
      assert.equal(r.totals!.total, feb.outstanding, "everything unpaid is from February");
      const ra = r.rows.find((x) => String(x.tenant).startsWith("Tenant a"));
      assert.equal(ra, undefined, "fully paid tenant isn't listed");
      const rc = r.rows.find((x) => String(x.tenant).startsWith("Tenant c"))!;
      assert.ok((rc.d30 as number) > 0, "Feb 15 cycle is 1–30 days late on Mar 1");
      assert.ok((rc.current as number) > 0 || (rc.d30 as number) > 0);
    });

    test("expenses and cash flow reconcile with the entries recorded above", async () => {
      const e = await m.reports.runReport(admin, "expenses", { propertyId, from: "2027-02", to: "2027-02" });
      const recorded = await m.prisma.expense.aggregate({ where: { propertyId, status: "RECORDED", incurredOn: { gte: new Date("2027-02-01"), lte: new Date("2027-02-28") } }, _sum: { amountCentavos: true } });
      assert.equal(e.rows[0].total, recorded._sum.amountCentavos);
      assert.equal(e.rows[0].UTILITIES_WATER, 430000);
      const cf = await m.reports.runReport(admin, "cashflow", { propertyId, from: "2027-01", to: "2027-03" });
      const jan = cf.rows.find((r) => r.month === "2027-01")!;
      assert.equal(jan.depositsIn, 1500000);
      const feb = cf.rows.find((r) => r.month === "2027-02")!;
      assert.equal(feb.rentIn, 1335000);
      const paidFeb = await m.prisma.expense.aggregate({ where: { propertyId, status: "RECORDED", paidOn: { gte: new Date("2027-02-01"), lte: new Date("2027-02-28") } }, _sum: { amountCentavos: true } });
      assert.equal(feb.expensesOut, paidFeb._sum.amountCentavos);
      assert.equal(feb.pettyDiff, -1000);
      const mar = cf.rows.find((r) => r.month === "2027-03")!;
      assert.equal(mar.rentIn, 0, "the advance-rent application isn't counted as new cash");
      assert.equal(cf.totals!.cumulative, (jan.net as number) + (feb.net as number) + (mar.net as number));
    });

    test("utilities, occupancy and deposits", async () => {
      const u = await m.reports.runReport(admin, "utilities", { propertyId, from: "2027-02", to: "2027-02" });
      assert.equal(u.rows[0].masterWater, 430000);
      assert.equal(u.rows[0].commonElectric, 180000);
      assert.equal(u.rows[0].masterUsage, 60.5, "bill consumption preferred over meter readings");
      assert.equal(u.rows[0].waterNet, (u.rows[0].waterBilled as number) - 430000);
      const o = await m.reports.runReport(admin, "occupancy", { propertyId, from: "2027-01", to: "2027-02" });
      assert.equal(o.rows[0].rate, 50, "Jan: 2 of 4 rooms all month");
      assert.equal(o.rows[1].occupiedEnd, 3);
      assert.equal(o.rows[1].moveIns, 1);
      const d = await m.reports.runReport(admin, "deposits", { propertyId });
      const b = d.rows.find((r) => String(r.tenant).startsWith("Tenant b"))!;
      assert.deepEqual([b.security, b.advance, b.total], [1000000, 300000, 1300000]);
    });

    test("office only, month range limited, CSV safe for spreadsheets", async () => {
      await assert.rejects(m.reports.runReport(otherAdmin, "income", { propertyId, from: "2027-01", to: "2027-02" }), /not found/i);
      await assert.rejects(m.reports.runReport(caretaker, "income", { propertyId, from: "2027-01", to: "2027-02" }), /access/i);
      await assert.rejects(m.reports.runReport(tenantActor("a"), "deposits", { propertyId }), /access/i);
      await assert.rejects(m.reports.runReport(admin, "income", { propertyId, from: "2025-01", to: "2027-02" }), /24 months/);
      await m.prisma.tenant.update({ where: { id: tenants.b }, data: { name: '=HYPERLINK("http://x","y"), "Ltd"' } });
      const csv = m.reports.toCsv(await m.reports.runReport(admin, "deposits", { propertyId }));
      assert.ok(csv.startsWith("﻿Room,Tenant,"));
      assert.match(csv, /"'=HYPERLINK\(""http:\/\/x"",""y""\), ""Ltd"""/, "formula neutralised and quotes escaped");
      assert.match(csv, /,10000\.00,3000\.00,13000\.00\r\n/, "pesos as plain numbers");
    });
  });
}
