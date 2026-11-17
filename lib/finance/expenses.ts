// Operating expenses per property, with private receipt files.
//
// Expenses are never deleted: a mistake is voided with a reason. Expenses
// created by a petty-cash disbursement or by paying a utility bill are
// corrected through their source so both sides always move together.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "@/lib/collections/actor";
import { toDbDate, type MonthKey } from "@/lib/collections/calendar";
import { audit, inTransaction, type Tx } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { optionalDate, optionalText, requireDate, requireText, today } from "@/lib/operations/common";
import { accountScope } from "@/lib/operations/maintenance";
import { amountFrom, monthEnd, monthStart, parseCategory, parseMethod, requireProperty } from "./common";

export interface ExpenseInput {
  propertyId?: unknown;
  category?: unknown;
  description?: unknown;
  vendor?: unknown;
  amountCentavos?: unknown;
  amount?: unknown;
  incurredOn?: unknown;
  paidOn?: unknown;
  method?: unknown;
  referenceNumber?: unknown;
  unitId?: unknown;
  maintenanceRequestId?: unknown;
}

/** Validates the parts shared by manual and petty-cash expenses. */
export async function expenseFields(actor: Actor, propertyId: string, input: ExpenseInput) {
  const category = parseCategory(input.category);
  const description = requireText(input.description, "Description", 300);
  const incurredOn = requireDate(input.incurredOn, "Date");
  if (incurredOn > today()) throw invalid("The expense date can't be in the future");
  let unitId: string | null = null;
  if (typeof input.unitId === "string" && input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, propertyId }, select: { id: true } });
    if (!unit) throw notFound("Room not found");
    unitId = unit.id;
  }
  let maintenanceRequestId: string | null = null;
  if (typeof input.maintenanceRequestId === "string" && input.maintenanceRequestId) {
    const req = await prisma.maintenanceRequest.findFirst({ where: { id: input.maintenanceRequestId, ...accountScope(actor.accountId) }, select: { id: true } });
    if (!req) throw notFound("Maintenance request not found");
    maintenanceRequestId = req.id;
  }
  return { category, description, incurredOn, unitId, maintenanceRequestId, vendor: optionalText(input.vendor, 120) };
}

async function receipt(actor: Actor, accountId: string, propertyId: string, file: File | null | undefined, purpose: "EXPENSE_RECEIPT" | "UTILITY_BILL" = "EXPENSE_RECEIPT") {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const upload = await readUpload(file);
  return (await storeFile({ actor, accountId, propertyId, tenantId: null, purpose, file }, upload)).id;
}
export { receipt as storeFinanceFile };

export async function recordExpense(actor: Actor, input: ExpenseInput, file?: File | null) {
  const property = await requireProperty(actor, input.propertyId);
  const f = await expenseFields(actor, property.id, input);
  const amount = amountFrom(input);
  const paidOn = optionalDate(input.paidOn, "Date paid");
  if (paidOn && paidOn > today()) throw invalid("The payment date can't be in the future");
  const method = parseMethod(input.method);
  if (method === "petty_cash") throw invalid("Record petty-cash spending from the Petty cash page so the cash balance stays right");
  const receiptFileId = await receipt(actor, property.accountId, property.id, file);
  return inTransaction(async (tx) => {
    const e = await tx.expense.create({
      data: {
        accountId: property.accountId,
        propertyId: property.id,
        unitId: f.unitId,
        maintenanceRequestId: f.maintenanceRequestId,
        category: f.category,
        description: f.description,
        vendor: f.vendor,
        amountCentavos: amount,
        incurredOn: toDbDate(f.incurredOn),
        paidOn: paidOn ? toDbDate(paidOn) : null,
        method,
        referenceNumber: optionalText(input.referenceNumber, 80),
        receiptFileId,
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "Expense", entityId: e.id, action: "expense_recorded", propertyId: property.id, details: { category: f.category, amountCentavos: amount } });
    return e;
  });
}

async function adminExpense(actor: Actor, id: string) {
  requireAdmin(actor);
  const e = await prisma.expense.findFirst({ where: { id, accountId: actor.accountId } });
  if (!e) throw notFound("Expense not found");
  return e;
}

export async function attachExpenseReceipt(actor: Actor, id: string, file: File | null) {
  const e = await adminExpense(actor, id);
  if (e.status === "VOID") throw conflict("This expense was voided");
  const fileId = await receipt(actor, e.accountId, e.propertyId, file);
  if (!fileId) throw invalid("Please attach a file");
  return inTransaction(async (tx) => {
    const saved = await tx.expense.update({ where: { id: e.id }, data: { receiptFileId: fileId } });
    await audit(tx, actor, { entityType: "Expense", entityId: e.id, action: "expense_receipt_attached", propertyId: e.propertyId, details: { fileId, replaced: e.receiptFileId } });
    return saved;
  });
}

/** Mark paid later (for expenses recorded as unpaid bills). */
export async function markExpensePaid(actor: Actor, id: string, input: { paidOn?: unknown; method?: unknown; referenceNumber?: unknown }) {
  const e = await adminExpense(actor, id);
  if (e.status === "VOID") throw conflict("This expense was voided");
  if (e.source !== "MANUAL") throw conflict("This expense is paid through its source");
  const paidOn = requireDate(input.paidOn, "Date paid");
  if (paidOn > today()) throw invalid("The payment date can't be in the future");
  const method = parseMethod(input.method);
  if (method === "petty_cash") throw invalid("Record petty-cash spending from the Petty cash page");
  return inTransaction(async (tx) => {
    const moved = await tx.expense.updateMany({ where: { id: e.id, paidOn: null, status: "RECORDED" }, data: { paidOn: toDbDate(paidOn), method, referenceNumber: optionalText(input.referenceNumber, 80) ?? e.referenceNumber } });
    if (!moved.count) throw conflict("Already marked as paid");
    await audit(tx, actor, { entityType: "Expense", entityId: e.id, action: "expense_paid", propertyId: e.propertyId, details: { paidOn, method } });
    return tx.expense.findUniqueOrThrow({ where: { id: e.id } });
  });
}

/** Void inside a transaction (also used by petty cash and utility bills). */
export async function voidExpenseTx(tx: Tx, actor: Actor, expenseId: string, reason: string) {
  const moved = await tx.expense.updateMany({ where: { id: expenseId, status: "RECORDED" }, data: { status: "VOID", voidReason: reason, voidedAt: new Date(), voidedBy: actor.id } });
  return moved.count > 0;
}

export async function voidExpense(actor: Actor, id: string, reasonRaw: unknown) {
  const e = await adminExpense(actor, id);
  const reason = requireText(reasonRaw, "Reason", 300);
  if (e.source === "PETTY_CASH") throw conflict("This was paid from petty cash — undo it on the Petty cash page so the cash balance is restored");
  return inTransaction(async (tx) => {
    if (!(await voidExpenseTx(tx, actor, e.id, reason))) throw conflict("Already voided");
    if (e.source === "UTILITY_BILL") {
      // The bill goes back to unpaid so it can be paid again correctly.
      await tx.utilityBill.updateMany({ where: { expenseId: e.id }, data: { status: "UNPAID", expenseId: null } });
    }
    await audit(tx, actor, { entityType: "Expense", entityId: e.id, action: "expense_voided", propertyId: e.propertyId, details: { reason, amountCentavos: e.amountCentavos, source: e.source } });
    return tx.expense.findUniqueOrThrow({ where: { id: e.id } });
  });
}

export async function listExpenses(actor: Actor, propertyId: string, filter: { month?: MonthKey; category?: string; includeVoid?: boolean } = {}) {
  await requireProperty(actor, propertyId);
  const where: Prisma.ExpenseWhereInput = {
    accountId: actor.accountId,
    propertyId,
    ...(filter.month ? { incurredOn: { gte: toDbDate(monthStart(filter.month)), lte: toDbDate(monthEnd(filter.month)) } } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.includeVoid ? {} : { status: "RECORDED" }),
  };
  return prisma.expense.findMany({ where, orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }], take: 500 });
}
