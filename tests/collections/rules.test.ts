// Pure financial rules — no database. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { formatCentavos, parsePesos, applyBasisPoints, legacyPesosToCentavos } from "@/lib/collections/money";
import { cycleSchedule, cyclesForMonth, resolveCycleDate, todayIn, validateCycles, cyclesDueForGeneration } from "@/lib/collections/calendar";
import { occupantWaterCharge, planCycleCharges, splitAcrossCycles, type RecurringChargeInput } from "@/lib/collections/plan";
import { allocateOldestFirst } from "@/lib/collections/allocation";
import { assessPenalty, penaltyConfigProblem } from "@/lib/collections/penalties";
import { computeStatementTotals, settlementStatus } from "@/lib/collections/statement-math";
import { excessProposal } from "@/lib/collections/meters";
import { expectedVecoMonths } from "@/lib/collections/veco";

const DAWSON = {
  cycles: [{ key: "A", day: 15 }, { key: "B", day: 30 }],
  shortMonthPolicy: "LAST_DAY" as const,
  generateDaysBefore: 3,
  distributeDaysBefore: 3,
  dueDaysAfter: 0,
};
const WATER = { waterEnabled: true, waterBaseCentavos: 35000, waterPerExtraCentavos: 20000, waterMaxOccupants: 4 };

test("money: parses peso text exactly and formats PHP", () => {
  assert.equal(parsePesos("1,234.5"), 123450);
  assert.equal(parsePesos("₱ 950"), 95000);
  assert.equal(parsePesos("0.1"), 10);
  assert.equal(parsePesos("1.005"), null, "more than two decimals is rejected, not rounded");
  assert.equal(parsePesos("-5"), null);
  assert.equal(parsePesos(0.1 + 0.2), 30, "float input is fixed to two places");
  assert.equal(formatCentavos(123450), "₱1,234.50");
  assert.equal(formatCentavos(-5000), "-₱50.00");
  assert.equal(legacyPesosToCentavos(4999.99), 499999);
  assert.equal(applyBasisPoints(300000, 500), 15000);
  assert.equal(applyBasisPoints(333, 500), 17, "5% of ₱3.33 rounds half-up to 17 centavos");
});

test("calendar: two cycles in a normal month", () => {
  const c = cyclesForMonth(DAWSON, "2026-11");
  assert.deepEqual(c.map((x) => [x.periodKey, x.cycleDate]), [["2026-11-A", "2026-11-15"], ["2026-11-B", "2026-11-30"]]);
});

test("calendar: February uses the last calendar day for the 30th", () => {
  assert.equal(resolveCycleDate("2027-02", 30, "LAST_DAY"), "2027-02-28");
  assert.equal(resolveCycleDate("2028-02", 30, "LAST_DAY"), "2028-02-29", "leap year");
  assert.equal(resolveCycleDate("2027-02", 30, "NEXT_MONTH_FIRST"), "2027-03-01");
  assert.equal(resolveCycleDate("2026-04", 31, "LAST_DAY"), "2026-04-30", "31st in a 30-day month");
  const feb = cyclesForMonth(DAWSON, "2027-02");
  assert.deepEqual(feb.map((x) => x.cycleDate), ["2027-02-15", "2027-02-28"]);
});

test("calendar: generation, distribution and due dates are distinct and configurable", () => {
  const s = cycleSchedule({ ...DAWSON, generateDaysBefore: 5, distributeDaysBefore: 2, dueDaysAfter: 3 }, "2026-11-B")!;
  assert.equal(s.cycleDate, "2026-11-30");
  assert.equal(s.generateOn, "2026-11-25");
  assert.equal(s.distributeOn, "2026-11-28");
  assert.equal(s.dueDate, "2026-12-03");
  assert.equal(s.periodStart, "2026-11-30");
  assert.equal(s.periodEnd, "2026-12-14");
  const feb = cycleSchedule(DAWSON, "2027-02-B")!;
  assert.equal(feb.periodEnd, "2027-03-14");
});

test("calendar: Manila date, not server date", () => {
  // 2026-11-14T17:30Z is already Nov 15 in Manila.
  assert.equal(todayIn("Asia/Manila", new Date("2026-11-14T17:30:00Z")), "2026-11-15");
  assert.throws(() => todayIn("America/New_York"));
});

test("calendar: cycle validation and due-for-generation window", () => {
  assert.equal(validateCycles(DAWSON.cycles), null);
  assert.ok(validateCycles([{ key: "A", day: 15 }, { key: "A", day: 30 }]));
  assert.ok(validateCycles([]));
  const due = cyclesDueForGeneration(DAWSON, "2026-11-12").map((c) => c.periodKey);
  assert.ok(due.includes("2026-11-A"));
  assert.ok(!due.includes("2026-11-B"));
});

test("water: ₱350 + ₱200 per extra occupant, 1–4 occupants", () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => (occupantWaterCharge(n, WATER) as { amountCentavos: number }).amountCentavos), [35000, 55000, 75000, 95000]);
  assert.ok("error" in occupantWaterCharge(5, WATER));
  assert.ok("error" in occupantWaterCharge(0, WATER));
  assert.ok("error" in occupantWaterCharge(null, WATER), "no occupant count → no automatic charge");
});

const rc = (over: Partial<RecurringChargeInput>): RecurringChargeInput => ({
  id: "r1",
  type: "RENT",
  description: "Room rent",
  amountCentavos: 500000,
  amountBasis: "PER_CYCLE",
  frequency: "EVERY_CYCLE",
  intervalMonths: 1,
  cycleKey: null,
  startMonth: "2026-01",
  endMonth: null,
  isActive: true,
  ...over,
});

test("plan: rent each cycle; monthly items only on the configured cycle", () => {
  const [a, b] = cyclesForMonth(DAWSON, "2026-11");
  const recurring = [rc({}), rc({ id: "i1", type: "INTERNET", description: "Internet", amountCentavos: 50000, amountBasis: "PER_OCCURRENCE", frequency: "MONTHLY" })];
  const base = { monthlyCycleKey: "A", recurring, water: WATER, occupantCount: 2, waterOverride: null };
  const pa = planCycleCharges({ ...base, cycle: a });
  const pb = planCycleCharges({ ...base, cycle: b });
  assert.deepEqual(pa.charges.map((c) => c.type).sort(), ["INTERNET", "RENT", "WATER"]);
  assert.deepEqual(pb.charges.map((c) => c.type), ["RENT"], "cycle B has rent only");
  assert.equal(pa.charges.find((c) => c.type === "WATER")!.amountCentavos, 55000);
  assert.equal(pa.charges.find((c) => c.type === "INTERNET")!.sourceKey, "rc:i1:2026-11", "monthly items keyed by month, not period");
  assert.equal(pa.charges.find((c) => c.type === "WATER")!.sourceKey, "water:2026-11");
  assert.notEqual(pa.charges.find((c) => c.type === "RENT")!.sourceKey, pb.charges[0].sourceKey);
});

test("plan: monthly rent split never doubles the monthly total", () => {
  const cycles = cyclesForMonth(DAWSON, "2026-11");
  const recurring = [rc({ amountBasis: "MONTHLY_SPLIT", amountCentavos: 1000001 })];
  const amounts = cycles.map((cycle) => planCycleCharges({ cycle, monthlyCycleKey: "A", recurring, water: { ...WATER, waterEnabled: false }, occupantCount: null, waterOverride: null }).charges[0].amountCentavos);
  assert.deepEqual(amounts, [500000, 500001]);
  assert.equal(amounts[0] + amounts[1], 1000001);
  assert.equal(splitAcrossCycles(900000, 0, 2) + splitAcrossCycles(900000, 1, 2), 900000);
});

test("plan: rent without an explicit basis is skipped with a note, not guessed", () => {
  const [a] = cyclesForMonth(DAWSON, "2026-11");
  const p = planCycleCharges({ cycle: a, monthlyCycleKey: "A", recurring: [rc({ amountBasis: "PER_OCCURRENCE" })], water: WATER, occupantCount: 1, waterOverride: null });
  assert.ok(!p.charges.some((c) => c.type === "RENT"));
  assert.ok(p.notes.some((n) => n.includes("per cycle or monthly")));
});

test("plan: water override with reason; parking every 3 months; ended charges stop", () => {
  const [a] = cyclesForMonth(DAWSON, "2026-11");
  const recurring = [
    rc({ id: "p1", type: "PARKING", description: "Parking", amountCentavos: 150000, amountBasis: "PER_OCCURRENCE", frequency: "EVERY_N_MONTHS", intervalMonths: 3, startMonth: "2026-08" }),
    rc({ id: "old", endMonth: "2026-10" }),
  ];
  const p = planCycleCharges({ cycle: a, monthlyCycleKey: "A", recurring, water: WATER, occupantCount: 3, waterOverride: { amountCentavos: 40000, reason: "Agreed discount" } });
  assert.equal(p.charges.find((c) => c.type === "WATER")!.amountCentavos, 40000);
  assert.ok(p.charges.some((c) => c.type === "PARKING"), "Aug + 3 months = Nov");
  assert.ok(!p.charges.some((c) => c.sourceId === "old"), "ended in October");
  const [dec] = cyclesForMonth(DAWSON, "2026-12");
  assert.ok(!planCycleCharges({ cycle: dec, monthlyCycleKey: "A", recurring, water: WATER, occupantCount: 3, waterOverride: null }).charges.some((c) => c.type === "PARKING"));
});

test("allocation: oldest charge first, remainder is credit", () => {
  const charges = [
    { id: "new", dueDate: "2026-11-30", createdAt: new Date(2), outstandingCentavos: 500000 },
    { id: "old", dueDate: "2026-11-15", createdAt: new Date(1), outstandingCentavos: 300000 },
  ];
  assert.deepEqual(allocateOldestFirst(charges, 200000), { allocations: [{ chargeId: "old", amountCentavos: 200000 }], remainingCentavos: 0 });
  const all = allocateOldestFirst(charges, 1000000);
  assert.deepEqual(all.allocations, [{ chargeId: "old", amountCentavos: 300000 }, { chargeId: "new", amountCentavos: 500000 }]);
  assert.equal(all.remainingCentavos, 200000);
  assert.throws(() => allocateOldestFirst(charges, 1.5));
});

test("penalties: off until configured; grace; exemptions; never compounding", () => {
  const off = { penaltyEnabled: false, penaltyRateBps: null, penaltyGraceDays: null, penaltyRepeat: "ONCE", penaltyBasis: "STATEMENT_UNPAID_CHARGES" };
  const cand = { statementId: "s1", dueDate: "2026-11-15", unpaidNonPenaltyCentavos: 300000, tenantExempt: false };
  assert.equal(assessPenalty(off, cand, "2026-12-30").apply, false);
  assert.ok(penaltyConfigProblem({ ...off, penaltyEnabled: true, penaltyRateBps: 500 }), "rate without grace is incomplete");
  const on = { ...off, penaltyEnabled: true, penaltyRateBps: 500, penaltyGraceDays: 5 };
  assert.equal(assessPenalty(on, cand, "2026-11-20").apply, false, "day 5 of grace");
  const d = assessPenalty(on, cand, "2026-11-21");
  assert.ok(d.apply && d.amountCentavos === 15000 && d.sourceKey === "penalty:s1");
  assert.equal(assessPenalty(on, { ...cand, tenantExempt: true }, "2026-12-01").apply, false);
  assert.equal(assessPenalty(on, { ...cand, unpaidNonPenaltyCentavos: 0 }, "2026-12-01").apply, false);
  assert.equal(assessPenalty({ ...on, penaltyRepeat: "MONTHLY" }, cand, "2026-12-01").apply, false, "repeat rule unconfirmed");
});

test("statement math: ₱5,000 − ₱2,000 = ₱3,000 carried; next cycle total ₱8,000 without re-charging", () => {
  // Cycle 1 issued: ₱5,000 rent. Tenant pays ₱2,000 (approved, allocated).
  // Cycle 2 issued: new ₱5,000 rent; previous ₱3,000 is shown, not charged again.
  const t = computeStatementTotals({
    lines: [{ type: "RENT", grossCentavos: 500000, adjustmentsCentavos: 0, allocatedCentavos: 0 }],
    previousOutstandingCentavos: 300000,
    unappliedCreditCentavos: 0,
  });
  assert.equal(t.previousBalanceCentavos, 300000);
  assert.equal(t.currentChargesCentavos, 500000);
  assert.equal(t.totalDueCentavos, 800000);
});

test("statement math: advance credit applied, penalties separate, credit balance", () => {
  const t = computeStatementTotals({
    lines: [
      { type: "RENT", grossCentavos: 500000, adjustmentsCentavos: 0, allocatedCentavos: 500000 },
      { type: "PENALTY", grossCentavos: 15000, adjustmentsCentavos: -15000, allocatedCentavos: 0 },
    ],
    previousOutstandingCentavos: 0,
    unappliedCreditCentavos: 100000,
  });
  assert.equal(t.penaltiesCentavos, 15000);
  assert.equal(t.adjustmentsCentavos, -15000);
  assert.equal(t.appliedToThisStatementCentavos, 500000);
  assert.equal(t.totalDueCentavos, -100000, "negative = credit balance");
});

test("settlement status is independent of payment verification", () => {
  const line = (alloc: number) => [{ type: "RENT", grossCentavos: 500000, adjustmentsCentavos: 0, allocatedCentavos: alloc }];
  assert.equal(settlementStatus(line(0), "2026-11-15", "2026-11-10"), "UNPAID");
  assert.equal(settlementStatus(line(200000), "2026-11-15", "2026-11-10"), "PARTIALLY_PAID");
  assert.equal(settlementStatus(line(200000), "2026-11-15", "2026-11-16"), "PARTIALLY_PAID_OVERDUE");
  assert.equal(settlementStatus(line(0), "2026-11-15", "2026-11-16"), "OVERDUE");
  assert.equal(settlementStatus(line(500000), "2026-11-15", "2026-11-16"), "PAID");
});

test("water excess: nothing proposed until allowance and rate are set", () => {
  const D = Prisma.Decimal;
  assert.equal(excessProposal(new D("12.5"), null, null), null);
  assert.equal(excessProposal(new D("12.5"), new D("10"), null), null);
  assert.equal(excessProposal(new D("9.9"), new D("10"), 5000), null);
  const p = excessProposal(new D("12.5"), new D("10"), 5000)!;
  assert.equal(p.excessUnits.toString(), "2.5");
  assert.equal(p.proposedCentavos, 12500);
});

test("VECO: expected receipt months respect move-in, tracking start and due day", () => {
  const m = expectedVecoMonths({ moveIn: "2026-08-20", moveOut: null, trackingStart: "2026-09", dueDay: 10, today: "2026-11-15" });
  assert.deepEqual(m, ["2026-09", "2026-10"]);
  const before = expectedVecoMonths({ moveIn: "2026-08-20", moveOut: null, trackingStart: "2026-09", dueDay: 10, today: "2026-11-05" });
  assert.deepEqual(before, ["2026-09"], "October isn't due until Nov 10");
});

// ─── Phase 1 follow-ups: proration and repeating penalties ──────────────────

test("proration: off by default bills the full cycle; DAILY prorates every-cycle rent only", async () => {
  const { occupiedDays } = await import("@/lib/collections/plan");
  const s = cycleSchedule(DAWSON, "2026-11-A")!; // Nov 15 – Nov 29 (15 days)
  assert.deepEqual(occupiedDays({ periodStart: s.periodStart, periodEnd: s.periodEnd, occupiedFrom: "2026-11-20", occupiedTo: null }), { occupied: 10, total: 15 });
  assert.deepEqual(occupiedDays({ periodStart: s.periodStart, periodEnd: s.periodEnd, occupiedFrom: "2026-10-01", occupiedTo: "2026-11-15" }), { occupied: 1, total: 15 });
  const rent: RecurringChargeInput = { id: "r", type: "RENT", description: "Rent", amountCentavos: 500000, amountBasis: "PER_CYCLE", frequency: "EVERY_CYCLE", intervalMonths: 1, cycleKey: null, startMonth: "2026-01", endMonth: null, isActive: true };
  const net: RecurringChargeInput = { ...rent, id: "n", type: "INTERNET", description: "Internet", amountCentavos: 50000, amountBasis: "PER_OCCURRENCE", frequency: "MONTHLY" };
  const base = { cycle: s, monthlyCycleKey: "A", recurring: [rent, net], water: WATER, occupantCount: 2, waterOverride: null };
  const full = planCycleCharges({ ...base, proration: { policy: "NONE", periodStart: s.periodStart, periodEnd: s.periodEnd, occupiedFrom: "2026-11-20", occupiedTo: null } });
  assert.equal(full.charges.find((c) => c.type === "RENT")!.amountCentavos, 500000);
  const pro = planCycleCharges({ ...base, proration: { policy: "DAILY", periodStart: s.periodStart, periodEnd: s.periodEnd, occupiedFrom: "2026-11-20", occupiedTo: null } });
  const r = pro.charges.find((c) => c.type === "RENT")!;
  assert.equal(r.amountCentavos, 333333, "5,000 × 10/15, rounded to the centavo");
  assert.equal((r.calc as { fullCentavos: number }).fullCentavos, 500000);
  assert.equal(pro.charges.find((c) => c.type === "INTERNET")!.amountCentavos, 50000, "monthly items are never prorated");
  assert.equal(pro.charges.find((c) => c.type === "WATER")!.amountCentavos, 55000, "water is never prorated");
  const whole = planCycleCharges({ ...base, proration: { policy: "DAILY", periodStart: s.periodStart, periodEnd: s.periodEnd, occupiedFrom: "2026-10-01", occupiedTo: null } });
  assert.equal(whole.charges.find((c) => c.type === "RENT")!.amountCentavos, 500000, "a full cycle is unchanged");
});

test("penalties: EACH_CYCLE needs a cap, repeats on the same basis, keys differ per carrying cycle", () => {
  const on = { penaltyEnabled: true, penaltyRateBps: 500, penaltyGraceDays: 3, penaltyRepeat: "EACH_CYCLE", penaltyBasis: "STATEMENT_UNPAID_CHARGES", penaltyMaxRepeats: null };
  assert.match(penaltyConfigProblem(on)!, /how many penalties/);
  const cfg = { ...on, penaltyMaxRepeats: 2 };
  assert.equal(penaltyConfigProblem(cfg), null);
  const cand = { statementId: "s1", dueDate: "2026-11-15", unpaidNonPenaltyCentavos: 500000, tenantExempt: false };
  const first = assessPenalty(cfg, { ...cand, priorPenalties: 0, carrierPeriodKey: "2026-12-A" }, "2026-12-01");
  const second = assessPenalty(cfg, { ...cand, priorPenalties: 1, carrierPeriodKey: "2026-12-B" }, "2026-12-20");
  const third = assessPenalty(cfg, { ...cand, priorPenalties: 2, carrierPeriodKey: "2027-01-A" }, "2027-01-10");
  assert.ok(first.apply && second.apply);
  assert.equal(third.apply, false, "cap reached");
  if (first.apply && second.apply) {
    assert.equal(first.sourceKey, "penalty:s1");
    assert.equal(second.sourceKey, "penalty:s1:2026-12-B");
    assert.equal(first.amountCentavos, 25000);
    assert.equal(second.amountCentavos, 25000, "repeat is on the statement's own unpaid charges — never compounding");
  }
  const once = { ...cfg, penaltyRepeat: "ONCE" };
  assert.equal(assessPenalty(once, { ...cand, priorPenalties: 1, carrierPeriodKey: "2026-12-B" }, "2026-12-20").apply, false, "ONCE never repeats");
});

test("maintenance statuses: legacy values normalize; role moves are limited", async () => {
  const { normalizeStatus, allowedMoves, rawStatuses } = await import("@/lib/operations/maintenance-status");
  assert.equal(normalizeStatus("open"), "SUBMITTED");
  assert.equal(normalizeStatus("in_progress"), "IN_PROGRESS");
  assert.equal(normalizeStatus("resolved"), "COMPLETED");
  assert.equal(normalizeStatus("WAITING"), "WAITING");
  assert.ok(rawStatuses(["SUBMITTED"]).includes("open"));
  assert.deepEqual(allowedMoves("CARETAKER", "SUBMITTED"), [], "caretakers can't pick up unassigned work");
  assert.ok(!allowedMoves("CARETAKER", "IN_PROGRESS").includes("CLOSED"), "only the office closes");
  assert.ok(allowedMoves("ADMIN", "COMPLETED").includes("CLOSED"));
  assert.deepEqual(allowedMoves("ADMIN", "CLOSED"), ["IN_PROGRESS"], "closed requests can only be reopened");
});

test("checklist template text: '*' marks required, blank lines ignored, limits enforced", async () => {
  const { parseItemLines, itemsToLines } = await import("@/lib/operations/checklists");
  const items = parseItemLines("* Keys returned\n\nRoom photos\n*  Final reading ");
  assert.deepEqual(items, [{ label: "Keys returned", required: true }, { label: "Room photos", required: false }, { label: "Final reading", required: true }]);
  assert.equal(itemsToLines(items), "* Keys returned\nRoom photos\n* Final reading");
  assert.throws(() => parseItemLines("   \n "), /at least one/);
});
