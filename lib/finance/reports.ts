// Owner reports for one property, computed on demand from the ledgers.
//
// Money is integer centavos throughout; every figure comes from the same
// tables the screens use (charges, adjustments, allocations, approved
// payments, deposits, expenses, petty cash, utility bills), so a report never
// disagrees with the ledger it summarises. Each report returns a plain table
// used both on screen and for CSV export.
//
// Definitions (printed under each report):
//  - Collected / income: APPROVED payments by the date paid (cash basis),
//    split by what they paid. Reversed payments are excluded entirely.
//  - Billed: POSTED charges by billing month, net of active waivers/reductions.
//  - Receivables: unpaid POSTED charges as of a date, aged by due date.
//  - Expenses: RECORDED (not voided) expenses by the date incurred.
//  - Cash flow: money in and out by date paid; petty-cash top-ups are
//    transfers and not counted, petty-cash spending is (as an expense).

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { fromDbDate, monthOf, toDbDate, type DateOnly, type MonthKey } from "@/lib/collections/calendar";
import { invalid } from "@/lib/collections/errors";
import { loadTenantLedger } from "@/lib/collections/ledger";
import { today, toDateOnly } from "@/lib/operations/common";
import { EXPENSE_CATEGORIES, monthEnd, monthRange, monthStart, requireProperty } from "./common";

export type CellKind = "text" | "money" | "number" | "percent";
export interface ReportColumn {
  key: string;
  label: string;
  kind: CellKind;
}
export type Row = Record<string, string | number | null>;
export interface ReportTable {
  name: ReportName;
  title: string;
  columns: ReportColumn[];
  rows: Row[];
  totals: Row | null;
  notes: string[];
}

export const REPORTS = {
  income: "Income (collected)",
  collections: "Collections (billed vs collected)",
  receivables: "Receivables aging",
  utilities: "Utilities",
  expenses: "Expenses",
  cashflow: "Cash flow",
  occupancy: "Occupancy",
  deposits: "Deposits held",
} as const;
export type ReportName = keyof typeof REPORTS;

export function parseReportName(v: unknown): ReportName {
  if (typeof v === "string" && v in REPORTS) return v as ReportName;
  throw invalid("Unknown report");
}

export interface ReportParams {
  propertyId: string;
  from: MonthKey;
  to: MonthKey;
  asOf?: DateOnly;
}

const money = (key: string, label: string): ReportColumn => ({ key, label, kind: "money" });

function sumRows(rows: Row[], columns: ReportColumn[], labelKey: string, label = "Total"): Row {
  const t: Row = { [labelKey]: label };
  for (const c of columns) if (c.key !== labelKey && (c.kind === "money" || c.kind === "number")) t[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  return t;
}

function inMonth(d: Date | null | undefined): MonthKey | null {
  return d ? monthOf(fromDbDate(d)) : null;
}

export async function runReport(actor: Actor, name: ReportName, params: { propertyId: unknown; from?: unknown; to?: unknown; asOf?: unknown }): Promise<ReportTable> {
  const property = await requireProperty(actor, params.propertyId);
  const months = name === "receivables" || name === "deposits" ? [] : monthRange(params.from, params.to);
  const asOf = typeof params.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.asOf) ? params.asOf : today();
  const p = { propertyId: property.id, from: months[0], to: months[months.length - 1], asOf };
  switch (name) {
    case "income":
      return income(p, months);
    case "collections":
      return collections(p, months);
    case "receivables":
      return receivables(p);
    case "utilities":
      return utilities(p, months);
    case "expenses":
      return expenses(p, months);
    case "cashflow":
      return cashflow(p, months);
    case "occupancy":
      return occupancy(p, months);
    case "deposits":
      return deposits(p);
  }
}

// Charge types grouped into report columns.
const INCOME_GROUPS: [string, string, string[]][] = [
  ["rent", "Rent", ["RENT"]],
  ["water", "Water", ["WATER", "WATER_EXCESS"]],
  ["internet", "Internet", ["INTERNET"]],
  ["parking", "Parking", ["PARKING"]],
  ["penalties", "Penalties", ["PENALTY"]],
  ["damages", "Damages", ["DAMAGE"]],
];
function groupOf(type: string): string {
  return INCOME_GROUPS.find(([, , types]) => types.includes(type))?.[0] ?? "other";
}

async function approvedPayments(propertyId: string, from: MonthKey, to: MonthKey) {
  return prisma.rentPayment.findMany({
    where: { propertyId, status: "APPROVED", paidOn: { gte: toDbDate(monthStart(from)), lte: toDbDate(monthEnd(to)) } },
    include: { allocations: { where: { reversedAt: null }, include: { charge: { select: { type: true } } } } },
  });
}

async function income(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const payments = await approvedPayments(p.propertyId, p.from, p.to);
  const columns: ReportColumn[] = [
    { key: "month", label: "Month", kind: "text" },
    ...INCOME_GROUPS.map(([k, l]) => money(k, l)),
    money("other", "Other charges"),
    money("credit", "Not yet applied (credit)"),
    money("total", "Total collected"),
  ];
  const rows: Row[] = months.map((m) => {
    const r: Row = { month: m, credit: 0, total: 0, other: 0 };
    for (const [k] of INCOME_GROUPS) r[k] = 0;
    for (const pay of payments.filter((x) => inMonth(x.paidOn) === m)) {
      let applied = 0;
      for (const a of pay.allocations) {
        const g = groupOf(a.charge.type);
        r[g] = (r[g] as number) + a.amountCentavos;
        applied += a.amountCentavos;
      }
      r.credit = (r.credit as number) + (pay.amountCentavos - applied);
      r.total = (r.total as number) + pay.amountCentavos;
    }
    return r;
  });
  return {
    name: "income",
    title: REPORTS.income,
    columns,
    rows,
    totals: sumRows(rows, columns, "month"),
    notes: [
      "Approved payments by the date paid, split by the charges they paid. Pending, rejected and reversed payments are not included.",
      "Security deposit or advance rent counts here only when the office applies it to charges (on the day it's applied).",
      "Only the statement-billing ledger is included; amounts kept in the older monthly ledger are not.",
    ],
  };
}

async function collections(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const charges = await prisma.charge.findMany({
    where: { propertyId: p.propertyId, status: "POSTED", billingMonth: { gte: p.from, lte: p.to } },
    include: { adjustments: { where: { reversedAt: null } }, allocations: { where: { reversedAt: null, payment: { status: "APPROVED" } } } },
  });
  const columns: ReportColumn[] = [
    { key: "month", label: "Billing month", kind: "text" },
    money("billed", "Billed"),
    money("adjusted", "Waived / reduced"),
    money("net", "Net billed"),
    money("collected", "Collected to date"),
    money("outstanding", "Still unpaid"),
    { key: "rate", label: "Collection rate", kind: "percent" },
  ];
  const rows: Row[] = months.map((m) => {
    const cs = charges.filter((c) => c.billingMonth === m && c.type !== "OPENING_BALANCE");
    const billed = cs.reduce((s, c) => s + c.amountCentavos, 0);
    const adjusted = cs.reduce((s, c) => s + c.adjustments.reduce((x, a) => x + a.amountCentavos, 0), 0);
    const collected = cs.reduce((s, c) => s + c.allocations.reduce((x, a) => x + a.amountCentavos, 0), 0);
    const net = billed + adjusted;
    return { month: m, billed, adjusted, net, collected, outstanding: net - collected, rate: net > 0 ? Math.round((collected / net) * 1000) / 10 : null };
  });
  const totals = sumRows(rows, columns, "month");
  totals.rate = (totals.net as number) > 0 ? Math.round(((totals.collected as number) / (totals.net as number)) * 1000) / 10 : null;
  return {
    name: "collections",
    title: REPORTS.collections,
    columns,
    rows,
    totals,
    notes: ["Issued charges by billing month (opening balances excluded), and how much of them has been paid so far by approved payments, whenever paid.", "The collection rate for recent months rises as tenants pay."],
  };
}

async function receivables(p: ReportParams): Promise<ReportTable> {
  const asOf = p.asOf ?? today();
  const tenants = await prisma.tenant.findMany({ where: { unit: { propertyId: p.propertyId }, charges: { some: { status: "POSTED" } } }, select: { id: true, name: true, isActive: true, unit: { select: { unitNumber: true } } }, orderBy: { unit: { unitNumber: "asc" } } });
  const columns: ReportColumn[] = [
    { key: "room", label: "Room", kind: "text" },
    { key: "tenant", label: "Tenant", kind: "text" },
    money("current", "Not yet due"),
    money("d30", "1–30 days late"),
    money("d60", "31–60 days"),
    money("d90", "61–90 days"),
    money("d90p", "Over 90 days"),
    money("total", "Total unpaid"),
    money("credit", "Credit"),
  ];
  const rows: Row[] = [];
  for (const t of tenants) {
    const ledger = await loadTenantLedger(prisma, t.id, asOf);
    const r: Row = { room: t.unit.unitNumber, tenant: t.name + (t.isActive ? "" : " (moved out)"), current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0, credit: ledger.creditCentavos };
    for (const c of ledger.charges) {
      if (c.outstandingCentavos <= 0) continue;
      const late = Math.round((Date.parse(asOf) - Date.parse(c.dueDate)) / 86_400_000);
      const k = late <= 0 ? "current" : late <= 30 ? "d30" : late <= 60 ? "d60" : late <= 90 ? "d90" : "d90p";
      r[k] = (r[k] as number) + c.outstandingCentavos;
      r.total = (r.total as number) + c.outstandingCentavos;
    }
    if ((r.total as number) > 0 || (r.credit as number) > 0) rows.push(r);
  }
  return {
    name: "receivables",
    title: `${REPORTS.receivables} as of ${asOf}`,
    columns,
    rows,
    totals: sumRows(rows, columns, "room"),
    notes: ["Unpaid issued charges, aged by how long past their due date they are. Only approved payments reduce these amounts.", "Moved-out tenants with a balance are included."],
  };
}

async function utilities(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const [charges, bills, roomReadings, masterReadings, veco, tenants] = await Promise.all([
    prisma.charge.findMany({ where: { propertyId: p.propertyId, status: "POSTED", type: { in: ["WATER", "WATER_EXCESS"] }, billingMonth: { gte: p.from, lte: p.to } }, include: { adjustments: { where: { reversedAt: null } }, allocations: { where: { reversedAt: null, payment: { status: "APPROVED" } } } } }),
    prisma.utilityBill.findMany({ where: { propertyId: p.propertyId, status: { not: "VOID" }, billingMonth: { gte: p.from, lte: p.to } } }),
    prisma.meterReading.findMany({ where: { propertyId: p.propertyId, status: "ACTIVE", readingDate: { gte: toDbDate(monthStart(p.from)), lte: toDbDate(monthEnd(p.to)) } }, select: { readingDate: true, usage: true } }),
    prisma.masterMeterReading.findMany({ where: { propertyId: p.propertyId, status: "ACTIVE", utility: "WATER", readingDate: { gte: toDbDate(monthStart(p.from)), lte: toDbDate(monthEnd(p.to)) } }, select: { readingDate: true, usage: true } }),
    prisma.vecoReceipt.findMany({ where: { propertyId: p.propertyId, billingMonth: { gte: p.from, lte: p.to }, status: { not: "REJECTED" } }, select: { billingMonth: true } }),
    prisma.tenant.findMany({ where: { unit: { propertyId: p.propertyId } }, select: { moveInDate: true, moveOutDate: true, isActive: true } }),
  ]);
  const columns: ReportColumn[] = [
    { key: "month", label: "Month", kind: "text" },
    money("waterBilled", "Water billed to tenants"),
    money("waterCollected", "Water collected"),
    money("masterWater", "Master water bill"),
    money("waterNet", "Billed minus master bill"),
    { key: "roomUsage", label: "Room meters usage (m³)", kind: "number" },
    { key: "masterUsage", label: "Main meter usage (m³)", kind: "number" },
    money("commonElectric", "Common-area electricity bill"),
    { key: "veco", label: "VECO receipts received", kind: "number" },
    { key: "vecoExpected", label: "Occupied rooms (VECO expected)", kind: "number" },
  ];
  const rows: Row[] = months.map((m) => {
    const cs = charges.filter((c) => c.billingMonth === m);
    const waterBilled = cs.reduce((s, c) => s + c.amountCentavos + c.adjustments.reduce((x, a) => x + a.amountCentavos, 0), 0);
    const waterCollected = cs.reduce((s, c) => s + c.allocations.reduce((x, a) => x + a.amountCentavos, 0), 0);
    const masterWater = bills.filter((b) => b.billingMonth === m && b.utility === "WATER" && b.scope === "MASTER").reduce((s, b) => s + b.amountCentavos, 0);
    const commonElectric = bills.filter((b) => b.billingMonth === m && b.utility === "ELECTRICITY").reduce((s, b) => s + b.amountCentavos, 0);
    const billConsumption = bills.filter((b) => b.billingMonth === m && b.utility === "WATER" && b.scope === "MASTER" && b.consumption).reduce((s, b) => s + Number(b.consumption), 0);
    const meterUsage = masterReadings.filter((r) => inMonth(r.readingDate) === m && r.usage).reduce((s, r) => s + Number(r.usage), 0);
    const roomUsage = roomReadings.filter((r) => inMonth(r.readingDate) === m && r.usage).reduce((s, r) => s + Number(r.usage), 0);
    const end = monthEnd(m);
    const start = monthStart(m);
    const occupied = tenants.filter((t) => toDateOnly(t.moveInDate) <= end && (!t.moveOutDate || toDateOnly(t.moveOutDate) >= start)).length;
    return {
      month: m,
      waterBilled,
      waterCollected,
      masterWater,
      waterNet: waterBilled - masterWater,
      roomUsage: Math.round(roomUsage * 1000) / 1000,
      masterUsage: Math.round((billConsumption || meterUsage) * 1000) / 1000,
      commonElectric,
      veco: veco.filter((v) => v.billingMonth === m).length,
      vecoExpected: occupied,
    };
  });
  return {
    name: "utilities",
    title: REPORTS.utilities,
    columns,
    rows,
    totals: sumRows(rows, columns, "month"),
    notes: [
      "Water billed: water and approved excess-water charges issued for the month, net of waivers. Collected: the part of those paid by approved payments.",
      "Master bill and common-area electricity come from the bills recorded under Utilities (voided bills excluded). Main meter usage uses the bill's consumption if entered, otherwise the building meter readings.",
      "Room electricity (VECO) is paid by tenants directly and is never income; the count shows receipts submitted per month.",
    ],
  };
}

async function expenses(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const rows0 = await prisma.expense.findMany({ where: { propertyId: p.propertyId, status: "RECORDED", incurredOn: { gte: toDbDate(monthStart(p.from)), lte: toDbDate(monthEnd(p.to)) } }, select: { category: true, amountCentavos: true, incurredOn: true } });
  const cats = Object.keys(EXPENSE_CATEGORIES) as (keyof typeof EXPENSE_CATEGORIES)[];
  const used = cats.filter((c) => rows0.some((r) => r.category === c));
  const columns: ReportColumn[] = [{ key: "month", label: "Month", kind: "text" }, ...used.map((c) => money(c, EXPENSE_CATEGORIES[c])), money("total", "Total")];
  const rows: Row[] = months.map((m) => {
    const r: Row = { month: m, total: 0 };
    for (const c of used) r[c] = 0;
    for (const e of rows0.filter((x) => inMonth(x.incurredOn) === m)) {
      r[e.category] = ((r[e.category] as number) ?? 0) + e.amountCentavos;
      r.total = (r.total as number) + e.amountCentavos;
    }
    return r;
  });
  return { name: "expenses", title: REPORTS.expenses, columns, rows, totals: sumRows(rows, columns, "month"), notes: ["Recorded expenses by the date incurred, including petty-cash spending and paid utility bills. Voided expenses are excluded."] };
}

async function cashflow(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const lo = toDbDate(monthStart(p.from));
  const hi = toDbDate(monthEnd(p.to));
  const [payments, deposits, exp, petty] = await Promise.all([
    prisma.rentPayment.findMany({ where: { propertyId: p.propertyId, status: "APPROVED", paidOn: { gte: lo, lte: hi }, method: { notIn: ["deposit", "advance_rent"] } }, select: { paidOn: true, amountCentavos: true } }),
    prisma.depositTransaction.findMany({ where: { propertyId: p.propertyId, occurredOn: { gte: lo, lte: hi } }, select: { kind: true, amountCentavos: true, occurredOn: true, reversalOfId: true } }),
    prisma.expense.findMany({ where: { propertyId: p.propertyId, status: "RECORDED", paidOn: { gte: lo, lte: hi } }, select: { paidOn: true, amountCentavos: true } }),
    prisma.pettyCashTransaction.findMany({ where: { propertyId: p.propertyId, kind: { in: ["COUNT_ADJUSTMENT", "REVERSAL"] }, occurredOn: { gte: lo, lte: hi } }, select: { kind: true, amountCentavos: true, occurredOn: true, reversalOfId: true } }),
  ]);
  // Reversal rows count only when they undo a cash movement.
  const originals = new Map(
    (await prisma.depositTransaction.findMany({ where: { id: { in: deposits.filter((d) => d.reversalOfId).map((d) => d.reversalOfId!) } }, select: { id: true, kind: true } })).map((d) => [d.id, d.kind]),
  );
  const pettyOriginals = new Map(
    (await prisma.pettyCashTransaction.findMany({ where: { id: { in: petty.filter((d) => d.reversalOfId).map((d) => d.reversalOfId!) } }, select: { id: true, kind: true } })).map((d) => [d.id, d.kind]),
  );
  const columns: ReportColumn[] = [
    { key: "month", label: "Month", kind: "text" },
    money("rentIn", "Rent and charges received"),
    money("depositsIn", "Deposits / advance received"),
    money("expensesOut", "Expenses paid"),
    money("refundsOut", "Deposits refunded"),
    money("pettyDiff", "Petty cash count differences"),
    money("net", "Net cash flow"),
    money("cumulative", "Cumulative"),
  ];
  let running = 0;
  const rows: Row[] = months.map((m) => {
    const rentIn = payments.filter((x) => inMonth(x.paidOn) === m).reduce((s, x) => s + x.amountCentavos, 0);
    let depositsIn = 0;
    let refundsOut = 0;
    for (const d of deposits.filter((x) => inMonth(x.occurredOn) === m)) {
      const kind = d.kind === "REVERSAL" ? originals.get(d.reversalOfId ?? "") : d.kind;
      if (kind === "RECEIVED") depositsIn += d.amountCentavos;
      if (kind === "REFUNDED") refundsOut += -d.amountCentavos;
    }
    const expensesOut = exp.filter((x) => inMonth(x.paidOn) === m).reduce((s, x) => s + x.amountCentavos, 0);
    let pettyDiff = 0;
    for (const t of petty.filter((x) => inMonth(x.occurredOn) === m)) {
      const kind = t.kind === "REVERSAL" ? pettyOriginals.get(t.reversalOfId ?? "") : t.kind;
      if (kind === "COUNT_ADJUSTMENT") pettyDiff += t.amountCentavos;
    }
    const net = rentIn + depositsIn - expensesOut - refundsOut + pettyDiff;
    running += net;
    return { month: m, rentIn, depositsIn, expensesOut, refundsOut, pettyDiff, net, cumulative: running };
  });
  const totals = sumRows(rows, columns, "month");
  totals.cumulative = running;
  return {
    name: "cashflow",
    title: REPORTS.cashflow,
    columns,
    rows,
    totals,
    notes: [
      "In: approved payments by date paid (deposit/advance applications are excluded here because that cash was counted when received), plus deposits and advance rent received.",
      "Out: expenses by date paid (unpaid expenses aren't included), including petty-cash spending; deposits refunded. Petty-cash top-ups are transfers and aren't counted. Count differences are shortages (−) or overages (+).",
      "Starts at zero for the first month shown; it's a movement report, not a bank balance.",
    ],
  };
}

async function occupancy(p: ReportParams & { from: MonthKey; to: MonthKey }, months: MonthKey[]): Promise<ReportTable> {
  const [units, tenants] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: p.propertyId }, select: { id: true } }),
    prisma.tenant.findMany({ where: { unit: { propertyId: p.propertyId } }, select: { unitId: true, moveInDate: true, moveOutDate: true, isActive: true } }),
  ]);
  const columns: ReportColumn[] = [
    { key: "month", label: "Month", kind: "text" },
    { key: "rooms", label: "Rooms", kind: "number" },
    { key: "occupiedEnd", label: "Occupied at month end", kind: "number" },
    { key: "rate", label: "Occupancy (room-days)", kind: "percent" },
    { key: "moveIns", label: "Move-ins", kind: "number" },
    { key: "moveOuts", label: "Move-outs", kind: "number" },
  ];
  const day = (d: DateOnly) => Date.parse(d) / 86_400_000;
  const rows: Row[] = months.map((m) => {
    const start = monthStart(m);
    const end = monthEnd(m);
    const days = day(end) - day(start) + 1;
    let roomDays = 0;
    for (const u of units) {
      const occupiedDays = new Set<number>();
      for (const t of tenants.filter((x) => x.unitId === u.id)) {
        const from = Math.max(day(start), day(toDateOnly(t.moveInDate)));
        const to = Math.min(day(end), t.moveOutDate ? day(toDateOnly(t.moveOutDate)) : t.isActive ? day(end) : day(toDateOnly(t.moveInDate)));
        for (let d = from; d <= to; d++) occupiedDays.add(d);
      }
      roomDays += occupiedDays.size;
    }
    const occupiedEnd = units.filter((u) => tenants.some((t) => t.unitId === u.id && toDateOnly(t.moveInDate) <= end && (t.moveOutDate ? toDateOnly(t.moveOutDate) >= end : t.isActive))).length;
    return {
      month: m,
      rooms: units.length,
      occupiedEnd,
      rate: units.length ? Math.round((roomDays / (units.length * days)) * 1000) / 10 : null,
      moveIns: tenants.filter((t) => monthOf(toDateOnly(t.moveInDate)) === m).length,
      moveOuts: tenants.filter((t) => t.moveOutDate && monthOf(toDateOnly(t.moveOutDate)) === m).length,
    };
  });
  return { name: "occupancy", title: REPORTS.occupancy, columns, rows, totals: null, notes: ["Occupancy counts the days each room had a tenancy (move-in to move-out). Rooms with two overlapping tenancies count once."] };
}

async function deposits(p: ReportParams): Promise<ReportTable> {
  const rows0 = await prisma.depositTransaction.groupBy({ by: ["tenantId", "fund"], where: { propertyId: p.propertyId }, _sum: { amountCentavos: true } });
  const tenantIds = [...new Set(rows0.map((r) => r.tenantId))];
  const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, isActive: true, unit: { select: { unitNumber: true } } } });
  const columns: ReportColumn[] = [
    { key: "room", label: "Room", kind: "text" },
    { key: "tenant", label: "Tenant", kind: "text" },
    money("security", "Security deposit held"),
    money("advance", "Advance rent held"),
    money("total", "Total held"),
  ];
  const rows: Row[] = tenants
    .map((t) => {
      const sec = rows0.find((r) => r.tenantId === t.id && r.fund === "SECURITY_DEPOSIT")?._sum.amountCentavos ?? 0;
      const adv = rows0.find((r) => r.tenantId === t.id && r.fund === "ADVANCE_RENT")?._sum.amountCentavos ?? 0;
      return { room: t.unit.unitNumber, tenant: t.name + (t.isActive ? "" : " (moved out)"), security: sec, advance: adv, total: sec + adv };
    })
    .filter((r) => r.total !== 0)
    .sort((a, b) => String(a.room).localeCompare(String(b.room), undefined, { numeric: true }));
  return { name: "deposits", title: `${REPORTS.deposits} as of ${today()}`, columns, rows, totals: sumRows(rows, columns, "room"), notes: ["Money held for each tenancy right now. It isn't income until applied to charges; refunds and forfeits reduce it."] };
}

/** CSV with pesos as plain numbers and text cells protected from spreadsheet formulas. */
export function toCsv(t: ReportTable): string {
  const cell = (c: ReportColumn, v: string | number | null | undefined): string => {
    if (v == null || v === "") return "";
    if (c.kind === "money") return ((v as number) / 100).toFixed(2);
    if (c.kind === "number" || c.kind === "percent") return String(v);
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [t.columns.map((c) => cell({ ...c, kind: "text" }, c.label)).join(",")];
  for (const r of t.rows) lines.push(t.columns.map((c) => cell(c, r[c.key])).join(","));
  if (t.totals) lines.push(t.columns.map((c) => cell(c, t.totals![c.key])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function defaultRange(): { from: MonthKey; to: MonthKey } {
  const to = monthOf(today());
  const [y, m] = to.split("-").map(Number);
  const fromDate = new Date(Date.UTC(y, m - 1 - 5, 1));
  return { from: `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}`, to };
}

