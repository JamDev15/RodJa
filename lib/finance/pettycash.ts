// Petty cash per property.
//
// Balance = SUM(amountCentavos) and never goes below zero (checked under a
// per-property lock). A disbursement records the matching Expense in the
// same transaction (method petty_cash), so expense reports include it; a
// top-up is a transfer into the box, not an expense. Count adjustments
// record a counted shortage/overage with a reason. Mistakes are undone with
// a REVERSAL row (and a disbursement's expense is voided with it).

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { toDbDate } from "@/lib/collections/calendar";
import { audit, inTransaction, lockKey, type Tx } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { formatCentavos, parsePesos } from "@/lib/collections/money";
import { optionalText, requireDate, requireText, today } from "@/lib/operations/common";
import { amountFrom, requireProperty } from "./common";
import { expenseFields, storeFinanceFile, voidExpenseTx, type ExpenseInput } from "./expenses";

async function balanceTx(tx: Tx, propertyId: string): Promise<number> {
  const agg = await tx.pettyCashTransaction.aggregate({ where: { propertyId }, _sum: { amountCentavos: true } });
  return agg._sum.amountCentavos ?? 0;
}

function lock(tx: Tx, propertyId: string) {
  return lockKey(tx, `pettycash:${propertyId}`);
}

function dateNotFuture(v: unknown): string {
  const d = requireDate(v, "Date");
  if (d > today()) throw invalid("The date can't be in the future");
  return d;
}

export async function pettyCashView(actor: Actor, propertyId: string) {
  await requireProperty(actor, propertyId);
  const rows = await prisma.pettyCashTransaction.findMany({ where: { accountId: actor.accountId, propertyId }, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }], take: 300 });
  const all = await prisma.pettyCashTransaction.aggregate({ where: { propertyId }, _sum: { amountCentavos: true } });
  const reversed = new Set(rows.filter((r) => r.reversalOfId).map((r) => r.reversalOfId!));
  return { balanceCentavos: all._sum.amountCentavos ?? 0, rows, reversed };
}

export async function topUp(actor: Actor, input: { propertyId?: unknown; amountCentavos?: unknown; amount?: unknown; occurredOn?: unknown; description?: unknown; reference?: unknown }) {
  const property = await requireProperty(actor, input.propertyId);
  const amount = amountFrom(input);
  const occurredOn = dateNotFuture(input.occurredOn);
  return inTransaction(async (tx) => {
    await lock(tx, property.id);
    const row = await tx.pettyCashTransaction.create({
      data: { accountId: property.accountId, propertyId: property.id, kind: "TOP_UP", amountCentavos: amount, occurredOn: toDbDate(occurredOn), description: optionalText(input.description, 200) ?? "Top-up", reference: optionalText(input.reference, 80), createdBy: actor.id },
    });
    await audit(tx, actor, { entityType: "PettyCashTransaction", entityId: row.id, action: "pettycash_topup", propertyId: property.id, details: { amountCentavos: amount } });
    return row;
  });
}

/** Spend from the box: one petty-cash row + one Expense, atomically. */
export async function disburse(actor: Actor, input: ExpenseInput & { reference?: unknown }, file?: File | null) {
  const property = await requireProperty(actor, input.propertyId);
  const f = await expenseFields(actor, property.id, input);
  const amount = amountFrom(input);
  const receiptFileId = await storeFinanceFile(actor, property.accountId, property.id, file);
  return inTransaction(async (tx) => {
    await lock(tx, property.id);
    const bal = await balanceTx(tx, property.id);
    if (amount > bal) throw conflict(`Petty cash only has ${formatCentavos(bal)}. Top it up first.`);
    const pcId = randomUUID();
    const expense = await tx.expense.create({
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
        paidOn: toDbDate(f.incurredOn),
        method: "petty_cash",
        referenceNumber: optionalText(input.reference, 80),
        receiptFileId,
        source: "PETTY_CASH",
        sourceId: pcId,
        createdBy: actor.id,
      },
    });
    const row = await tx.pettyCashTransaction.create({
      data: {
        id: pcId,
        accountId: property.accountId,
        propertyId: property.id,
        kind: "DISBURSEMENT",
        amountCentavos: -amount,
        occurredOn: toDbDate(f.incurredOn),
        description: f.description,
        category: f.category,
        receiptFileId,
        expenseId: expense.id,
        reference: optionalText(input.reference, 80),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "PettyCashTransaction", entityId: row.id, action: "pettycash_disbursed", propertyId: property.id, details: { amountCentavos: amount, expenseId: expense.id, category: f.category } });
    return { transaction: row, expense };
  });
}

/** Record the result of counting the cash box: the difference becomes an adjustment with a reason. */
export async function recordCount(actor: Actor, input: { propertyId?: unknown; countedCentavos?: unknown; counted?: unknown; occurredOn?: unknown; reason?: unknown }) {
  const property = await requireProperty(actor, input.propertyId);
  const counted = input.countedCentavos != null && input.countedCentavos !== "" ? Number(input.countedCentavos) : parsePesos(String(input.counted ?? ""));
  if (counted == null || !Number.isInteger(counted) || counted < 0) throw invalid("Enter the amount counted (zero or more)");
  const occurredOn = dateNotFuture(input.occurredOn);
  const reason = requireText(input.reason, "Reason / explanation", 300);
  return inTransaction(async (tx) => {
    await lock(tx, property.id);
    const bal = await balanceTx(tx, property.id);
    const diff = counted - bal;
    if (diff === 0) throw conflict("The count matches the recorded balance — nothing to adjust");
    const row = await tx.pettyCashTransaction.create({
      data: { accountId: property.accountId, propertyId: property.id, kind: "COUNT_ADJUSTMENT", amountCentavos: diff, occurredOn: toDbDate(occurredOn), description: `${diff < 0 ? "Shortage" : "Overage"} found when counting: ${reason}`, createdBy: actor.id },
    });
    await audit(tx, actor, { entityType: "PettyCashTransaction", entityId: row.id, action: "pettycash_counted", propertyId: property.id, details: { recordedCentavos: bal, countedCentavos: counted, differenceCentavos: diff, reason } });
    return { transaction: row, differenceCentavos: diff };
  });
}

export async function reversePettyCash(actor: Actor, id: string, reasonRaw: unknown) {
  const reason = requireText(reasonRaw, "Reason", 300);
  const row = await prisma.pettyCashTransaction.findFirst({ where: { id, accountId: actor.accountId } });
  if (!row) throw notFound("Entry not found");
  await requireProperty(actor, row.propertyId);
  if (row.kind === "REVERSAL") throw conflict("A reversal can't itself be undone — record a new entry instead");
  return inTransaction(async (tx) => {
    await lock(tx, row.propertyId);
    const already = await tx.pettyCashTransaction.findUnique({ where: { reversalOfId: row.id } });
    if (already) return { reversal: already, alreadyReversed: true };
    const bal = await balanceTx(tx, row.propertyId);
    if (bal - row.amountCentavos < 0) throw conflict("Undoing this would make the petty cash balance negative — record the later spending first or top up");
    if (row.kind === "DISBURSEMENT" && row.expenseId) await voidExpenseTx(tx, actor, row.expenseId, `Petty cash entry undone: ${reason}`);
    const reversal = await tx.pettyCashTransaction.create({
      data: { accountId: row.accountId, propertyId: row.propertyId, kind: "REVERSAL", amountCentavos: -row.amountCentavos, occurredOn: toDbDate(today()), description: `Undo: ${row.description} — ${reason}`.slice(0, 300), reversalOfId: row.id, createdBy: actor.id },
    });
    await audit(tx, actor, { entityType: "PettyCashTransaction", entityId: row.id, action: "pettycash_reversed", propertyId: row.propertyId, details: { kind: row.kind, amountCentavos: row.amountCentavos, reason } });
    return { reversal, alreadyReversed: false };
  });
}
