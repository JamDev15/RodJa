// The building's own utilities: master water and common-area electricity
// bills, and readings of the building's own meters.
//
// One active bill per property, utility, scope and month (checked under a
// lock). Paying a bill records an Expense (source UTILITY_BILL) in the same
// transaction; voiding that expense puts the bill back to unpaid.
// Building meter readings follow the room-meter rules: date order, no lower
// value unless the meter was replaced/reset, only the latest can be voided.

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { caretakerPropertyIds, type Actor } from "@/lib/collections/actor";
import { fromDbDate, isValidMonth, toDbDate, type MonthKey } from "@/lib/collections/calendar";
import { audit, inTransaction, lockKey } from "@/lib/collections/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/collections/errors";
import { optionalDate, optionalText, requireDate, requireText, today } from "@/lib/operations/common";
import { amountFrom, parseMethod, requireProperty } from "./common";
import { storeFinanceFile } from "./expenses";

export const UTILITIES = { WATER: "Water", ELECTRICITY: "Electricity" } as const;
export const SCOPES = { MASTER: "Master (whole building)", COMMON_AREA: "Common areas" } as const;
type Utility = keyof typeof UTILITIES;
type Scope = keyof typeof SCOPES;

function parseUtility(v: unknown): Utility {
  if (v === "WATER" || v === "ELECTRICITY") return v;
  throw invalid("Choose water or electricity");
}
function parseScope(v: unknown): Scope {
  if (v === "MASTER" || v === "COMMON_AREA") return v;
  throw invalid("Choose master or common areas");
}

function optionalDecimal(v: unknown, label: string): Prisma.Decimal | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(s)) throw invalid(`${label} must be a number (up to 3 decimals)`);
  return new Prisma.Decimal(s);
}

export interface BillInput {
  propertyId?: unknown;
  utility?: unknown;
  scope?: unknown;
  billingMonth?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  accountNumber?: unknown;
  consumption?: unknown;
  amountCentavos?: unknown;
  amount?: unknown;
  dueDate?: unknown;
  notes?: unknown;
}

export async function recordUtilityBill(actor: Actor, input: BillInput, file?: File | null) {
  const property = await requireProperty(actor, input.propertyId);
  const utility = parseUtility(input.utility);
  const scope = parseScope(input.scope);
  const billingMonth = String(input.billingMonth ?? "");
  if (!isValidMonth(billingMonth)) throw invalid("Choose the bill month (YYYY-MM)");
  const amount = amountFrom(input);
  const periodStart = optionalDate(input.periodStart, "Period start");
  const periodEnd = optionalDate(input.periodEnd, "Period end");
  if (periodStart && periodEnd && periodEnd < periodStart) throw invalid("The period ends before it starts");
  const billFileId = await storeFinanceFile(actor, property.accountId, property.id, file, "UTILITY_BILL");
  return inTransaction(async (tx) => {
    await lockKey(tx, `utilitybill:${property.id}:${utility}:${scope}:${billingMonth}`);
    const dup = await tx.utilityBill.findFirst({ where: { propertyId: property.id, utility, scope, billingMonth, status: { not: "VOID" } } });
    if (dup) throw conflict(`There's already a ${UTILITIES[utility].toLowerCase()} bill for ${billingMonth} (${SCOPES[scope].toLowerCase()}). Edit or void it instead.`);
    const bill = await tx.utilityBill.create({
      data: {
        accountId: property.accountId,
        propertyId: property.id,
        utility,
        scope,
        billingMonth,
        periodStart: periodStart ? toDbDate(periodStart) : null,
        periodEnd: periodEnd ? toDbDate(periodEnd) : null,
        accountNumber: optionalText(input.accountNumber, 60),
        consumption: optionalDecimal(input.consumption, "Consumption"),
        consumptionUnit: utility === "WATER" ? "m3" : "kWh",
        amountCentavos: amount,
        dueDate: optionalDate(input.dueDate, "Due date") ? toDbDate(optionalDate(input.dueDate, "Due date")!) : null,
        billFileId,
        notes: optionalText(input.notes, 500),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "UtilityBill", entityId: bill.id, action: "utility_bill_recorded", propertyId: property.id, details: { utility, scope, billingMonth, amountCentavos: amount } });
    return bill;
  });
}

async function adminBill(actor: Actor, id: string) {
  const bill = await prisma.utilityBill.findFirst({ where: { id, accountId: actor.accountId } });
  if (!bill) throw notFound("Bill not found");
  await requireProperty(actor, bill.propertyId);
  return bill;
}

/** Correct an unpaid bill (amount, consumption, dates). The change is audited with before/after. */
export async function updateUtilityBill(actor: Actor, id: string, input: BillInput) {
  const bill = await adminBill(actor, id);
  if (bill.status !== "UNPAID") throw conflict(bill.status === "PAID" ? "This bill is paid — void the payment's expense first to correct it" : "This bill was voided");
  const data: Prisma.UtilityBillUpdateInput = {};
  if (input.amountCentavos != null || input.amount != null) data.amountCentavos = amountFrom(input);
  if (input.consumption !== undefined) data.consumption = optionalDecimal(input.consumption, "Consumption");
  if (input.dueDate !== undefined) data.dueDate = optionalDate(input.dueDate, "Due date") ? toDbDate(optionalDate(input.dueDate, "Due date")!) : null;
  if (input.notes !== undefined) data.notes = optionalText(input.notes, 500);
  if (input.accountNumber !== undefined) data.accountNumber = optionalText(input.accountNumber, 60);
  return inTransaction(async (tx) => {
    const saved = await tx.utilityBill.update({ where: { id: bill.id }, data });
    await audit(tx, actor, { entityType: "UtilityBill", entityId: bill.id, action: "utility_bill_corrected", propertyId: bill.propertyId, details: { before: { amountCentavos: bill.amountCentavos, consumption: bill.consumption?.toString() ?? null }, after: { amountCentavos: saved.amountCentavos, consumption: saved.consumption?.toString() ?? null } } });
    return saved;
  });
}

export async function attachBillFile(actor: Actor, id: string, file: File | null) {
  const bill = await adminBill(actor, id);
  const fileId = await storeFinanceFile(actor, bill.accountId, bill.propertyId, file, "UTILITY_BILL");
  if (!fileId) throw invalid("Please attach a file");
  return prisma.utilityBill.update({ where: { id: bill.id }, data: { billFileId: fileId } });
}

/** Pay a bill: records the Expense and marks the bill paid, once. */
export async function payUtilityBill(actor: Actor, id: string, input: { paidOn?: unknown; method?: unknown; referenceNumber?: unknown }) {
  const bill = await adminBill(actor, id);
  const paidOn = requireDate(input.paidOn, "Date paid");
  if (paidOn > today()) throw invalid("The payment date can't be in the future");
  const method = parseMethod(input.method);
  if (method === "petty_cash") throw invalid("Pay bills from petty cash on the Petty cash page");
  return inTransaction(async (tx) => {
    await lockKey(tx, `utilitybill-pay:${bill.id}`);
    const fresh = await tx.utilityBill.findUniqueOrThrow({ where: { id: bill.id } });
    if (fresh.status === "PAID") return { bill: fresh, alreadyPaid: true };
    if (fresh.status === "VOID") throw conflict("This bill was voided");
    const expense = await tx.expense.create({
      data: {
        accountId: fresh.accountId,
        propertyId: fresh.propertyId,
        category: fresh.utility === "WATER" ? "UTILITIES_WATER" : "UTILITIES_ELECTRICITY",
        description: `${UTILITIES[fresh.utility as Utility]} bill ${fresh.billingMonth} (${SCOPES[fresh.scope as Scope].toLowerCase()})`,
        amountCentavos: fresh.amountCentavos,
        incurredOn: toDbDate(`${fresh.billingMonth}-01`),
        paidOn: toDbDate(paidOn),
        method,
        referenceNumber: optionalText(input.referenceNumber, 80),
        receiptFileId: fresh.billFileId,
        source: "UTILITY_BILL",
        // A fresh sourceId per payment keeps sourceId unique even if an
        // earlier payment of this bill was voided.
        sourceId: fresh.id + ":" + randomUUID().slice(0, 8),
        createdBy: actor.id,
      },
    });
    const saved = await tx.utilityBill.update({ where: { id: fresh.id }, data: { status: "PAID", expenseId: expense.id } });
    await audit(tx, actor, { entityType: "UtilityBill", entityId: fresh.id, action: "utility_bill_paid", propertyId: fresh.propertyId, details: { expenseId: expense.id, paidOn, method } });
    return { bill: saved, alreadyPaid: false };
  });
}

export async function voidUtilityBill(actor: Actor, id: string, reasonRaw: unknown) {
  const bill = await adminBill(actor, id);
  const reason = requireText(reasonRaw, "Reason", 300);
  if (bill.status === "PAID") throw conflict("This bill is paid — void its expense first");
  return inTransaction(async (tx) => {
    const moved = await tx.utilityBill.updateMany({ where: { id: bill.id, status: "UNPAID" }, data: { status: "VOID", voidReason: reason } });
    if (!moved.count) throw conflict("This bill was already voided or paid");
    await audit(tx, actor, { entityType: "UtilityBill", entityId: bill.id, action: "utility_bill_voided", propertyId: bill.propertyId, details: { reason } });
    return tx.utilityBill.findUniqueOrThrow({ where: { id: bill.id } });
  });
}

export async function listUtilityBills(actor: Actor, propertyId: string, months?: { from: MonthKey; to: MonthKey }) {
  await requireProperty(actor, propertyId);
  return prisma.utilityBill.findMany({
    where: { accountId: actor.accountId, propertyId, ...(months ? { billingMonth: { gte: months.from, lte: months.to } } : {}) },
    orderBy: [{ billingMonth: "desc" }, { utility: "asc" }],
    take: 200,
  });
}

// ─── Building meters ────────────────────────────────────────────────────────

async function meterAccess(actor: Actor | null, propertyId: string) {
  if (actor?.kind === "ADMIN") return requireProperty(actor, propertyId);
  if (actor?.kind === "CARETAKER") {
    const ids = await caretakerPropertyIds(actor);
    if (!ids.includes(propertyId)) throw notFound("Property not found");
    return prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
  }
  throw forbidden();
}

export async function addMasterReading(actor: Actor, input: { propertyId?: unknown; utility?: unknown; meterLabel?: unknown; value?: unknown; readingDate?: unknown; isMeterReset?: unknown; notes?: unknown }) {
  const property = await meterAccess(actor, String(input.propertyId ?? ""));
  const utility = parseUtility(input.utility);
  const meterLabel = optionalText(input.meterLabel, 60) ?? (utility === "WATER" ? "Main water meter" : "Common-area electric meter");
  const readingDate = requireDate(input.readingDate, "Reading date");
  if (readingDate > today()) throw invalid("Reading date can't be in the future");
  const raw = String(input.value ?? "").trim();
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(raw)) throw invalid("Enter the meter reading as a number (up to 3 decimals)");
  const value = new Prisma.Decimal(raw);
  const isReset = input.isMeterReset === true;
  return inTransaction(async (tx) => {
    await lockKey(tx, `mastermeter:${property.id}:${utility}:${meterLabel}`);
    const prev = await tx.masterMeterReading.findFirst({ where: { propertyId: property.id, utility, meterLabel, status: "ACTIVE" }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }] });
    if (prev) {
      const prevDate = fromDbDate(prev.readingDate);
      if (readingDate < prevDate) throw conflict(`A later reading (${prevDate}) already exists for this meter. Readings must be entered in date order.`);
      if (readingDate === prevDate) throw conflict(`There's already a reading for ${prevDate}. Void it first if it was wrong.`);
      if (!isReset && value.lessThan(prev.value)) throw invalid(`This reading (${value.toString()}) is lower than the last one (${prev.value.toString()}). If the meter was replaced or reset, tick "Meter replaced or reset".`);
    }
    const usage = prev && !isReset ? value.minus(prev.value) : null;
    const reading = await tx.masterMeterReading.create({
      data: { accountId: property.accountId, propertyId: property.id, utility, meterLabel, readingDate: toDbDate(readingDate), value, isMeterReset: isReset, previousReadingId: prev?.id ?? null, usage, notes: optionalText(input.notes, 300), enteredBy: actor.id, enteredByRole: actor.role },
    });
    await audit(tx, actor, { entityType: "MasterMeterReading", entityId: reading.id, action: "master_reading_added", propertyId: property.id, details: { utility, meterLabel, value: raw, readingDate, isReset, usage: usage?.toString() ?? null } });
    return reading;
  });
}

export async function voidMasterReading(actor: Actor, id: string, reasonRaw: unknown) {
  const reason = requireText(reasonRaw, "Reason", 300);
  const r = await prisma.masterMeterReading.findFirst({ where: { id, accountId: actor.accountId } });
  if (!r) throw notFound("Reading not found");
  await requireProperty(actor, r.propertyId); // office only
  return inTransaction(async (tx) => {
    const later = await tx.masterMeterReading.findFirst({ where: { propertyId: r.propertyId, utility: r.utility, meterLabel: r.meterLabel, status: "ACTIVE", readingDate: { gt: r.readingDate } } });
    if (later) throw conflict("Only the most recent reading can be voided");
    const moved = await tx.masterMeterReading.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "VOID", voidReason: reason } });
    if (!moved.count) throw conflict("Already voided");
    await audit(tx, actor, { entityType: "MasterMeterReading", entityId: r.id, action: "master_reading_voided", propertyId: r.propertyId, details: { reason } });
    return { ok: true };
  });
}

export async function listMasterReadings(actor: Actor, propertyId: string, take = 60) {
  await meterAccess(actor, propertyId);
  return prisma.masterMeterReading.findMany({ where: { propertyId }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }], take });
}
