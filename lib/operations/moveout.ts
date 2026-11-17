// Move-out workflow for one tenancy.
//
//   start → inspection (notes + photos) → final meter reading → damages
//   (posted as DAMAGE charges on the tenant's ledger) → deposit settled
//   (applied to charges / refunded / forfeited) → office approves vacancy.
//
// Dawson's move-out SOP hasn't been provided, so every step is optional
// except the guards on approving vacancy, which protect the money:
//  - the move-out checklist's required items are done;
//  - both deposit funds are fully settled (balance zero);
//  - the final meter reading is recorded when the room has a meter;
//  - the rent balance is zero, or the office records why it stays open.
// Approving vacancy ends the tenancy (moveOutDate, inactive), moves out
// every remaining occupant and marks the room vacant if nobody else lives there.

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { fromDbDate, toDbDate } from "@/lib/collections/calendar";
import { audit, inTransaction, lockTenant } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { applyCredits, loadTenantLedger } from "@/lib/collections/ledger";
import { addMeterReading } from "@/lib/collections/meters";
import { checklistsFor, openRequired, startChecklist } from "./checklists";
import { depositSummary } from "./deposits";
import { adminTenant, optionalDate, optionalText, requireDate, requireText, today, toDateOnly } from "./common";

export async function startMoveOut(actor: Actor, tenantId: string, input: { plannedDate?: unknown; noticeDate?: unknown; reason?: unknown }) {
  const tenant = await adminTenant(actor, tenantId);
  if (!tenant.isActive) throw conflict("This tenancy has already ended");
  const plannedDate = requireDate(input.plannedDate, "Planned move-out date");
  const noticeDate = optionalDate(input.noticeDate, "Notice date");
  if (plannedDate < toDateOnly(tenant.moveInDate)) throw invalid("Move-out can't be before the move-in date");
  const existing = await prisma.moveOut.findUnique({ where: { tenantId } });
  if (existing && existing.status !== "CANCELLED") return existing;
  const mo = await inTransaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const data = {
      status: "IN_PROGRESS",
      plannedDate: toDbDate(plannedDate),
      noticeDate: noticeDate ? toDbDate(noticeDate) : null,
      reason: optionalText(input.reason, 500),
      cancelledReason: null,
    };
    const saved = existing
      ? await tx.moveOut.update({ where: { id: existing.id }, data })
      : await tx.moveOut.create({ data: { ...data, accountId: tenant.unit.property.accountId, propertyId: tenant.unit.propertyId, unitId: tenant.unitId, tenantId, createdBy: actor.id } });
    await audit(tx, actor, { entityType: "MoveOut", entityId: saved.id, action: "moveout_started", propertyId: tenant.unit.propertyId, tenantId, details: { plannedDate, noticeDate } });
    return saved;
  });
  await startChecklist(actor, tenantId, "MOVE_OUT");
  return mo;
}

async function adminMoveOut(actor: Actor, moveOutId: string) {
  const mo = await prisma.moveOut.findFirst({ where: { id: moveOutId, accountId: actor.accountId } });
  if (!mo) throw notFound("Move-out not found");
  const tenant = await adminTenant(actor, mo.tenantId);
  return { mo, tenant };
}

function requireOpen(mo: { status: string }) {
  if (mo.status === "COMPLETED") throw conflict("This move-out is already completed");
  if (mo.status === "CANCELLED") throw conflict("This move-out was cancelled");
}

export async function recordInspection(actor: Actor, moveOutId: string, input: { notes?: unknown }) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  requireOpen(mo);
  const notes = requireText(input.notes, "Inspection notes", 4000);
  return inTransaction(async (tx) => {
    const saved = await tx.moveOut.update({ where: { id: mo.id }, data: { inspectionNotes: notes, inspectedAt: new Date(), inspectedBy: actor.id } });
    await audit(tx, actor, { entityType: "MoveOut", entityId: mo.id, action: "moveout_inspected", propertyId: tenant.unit.propertyId, tenantId: tenant.id });
    return saved;
  });
}

export async function addInspectionPhoto(actor: Actor, moveOutId: string, file: File | null) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  requireOpen(mo);
  const upload = await readUpload(file);
  const stored = await storeFile({ actor, accountId: mo.accountId, propertyId: mo.propertyId, tenantId: tenant.id, purpose: "MOVEOUT_PHOTO", file: file! }, upload);
  return inTransaction(async (tx) => {
    const fresh = await tx.moveOut.findUniqueOrThrow({ where: { id: mo.id } });
    const ids = [...((fresh.inspectionPhotoIds as string[] | null) ?? []), stored.id];
    return tx.moveOut.update({ where: { id: mo.id }, data: { inspectionPhotoIds: ids as Prisma.InputJsonValue } });
  });
}

/** Record the closing water meter reading through the normal meter rules. */
export async function recordFinalReading(actor: Actor, moveOutId: string, input: { value?: unknown; readingDate?: unknown; isMeterReset?: unknown }) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  requireOpen(mo);
  const result = await addMeterReading(actor, { unitId: tenant.unitId, value: String(input.value ?? ""), readingDate: requireDate(input.readingDate, "Reading date"), isMeterReset: input.isMeterReset === true, notes: "Final reading at move-out" });
  await prisma.moveOut.update({ where: { id: mo.id }, data: { finalReadingId: result.reading.id } });
  return result;
}

/** Post a damages charge to the tenant's ledger (outside any statement). */
export async function addDamageCharge(actor: Actor, moveOutId: string, input: { description?: unknown; amountCentavos?: unknown; clientRequestId?: unknown }) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  requireOpen(mo);
  const description = requireText(input.description, "Description", 200);
  const amount = typeof input.amountCentavos === "number" ? input.amountCentavos : Number(input.amountCentavos);
  if (!Number.isInteger(amount) || amount <= 0) throw invalid("Amount must be more than zero");
  // A per-form request id makes a double submit land on the same sourceKey.
  const key = typeof input.clientRequestId === "string" && /^[\w-]{8,64}$/.test(input.clientRequestId) ? input.clientRequestId : randomUUID();
  const day = today();
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    const sourceKey = `moveout:${mo.id}:${key}`;
    const existing = await tx.charge.findUnique({ where: { tenantId_sourceKey: { tenantId: tenant.id, sourceKey } } });
    if (existing) return existing;
    const charge = await tx.charge.create({
      data: {
        accountId: mo.accountId,
        propertyId: mo.propertyId,
        unitId: mo.unitId,
        tenantId: tenant.id,
        type: "DAMAGE",
        description: `Damages: ${description}`,
        amountCentavos: amount,
        billingMonth: day.slice(0, 7),
        dueDate: toDbDate(day),
        sourceKey,
        sourceId: mo.id,
        status: "POSTED",
        postedAt: new Date(),
        createdBy: actor.id,
      },
    });
    await applyCredits(tx, tenant.id);
    await audit(tx, actor, { entityType: "Charge", entityId: charge.id, action: "damage_charged", propertyId: mo.propertyId, tenantId: tenant.id, details: { description, amountCentavos: amount, moveOutId: mo.id } });
    return charge;
  });
}

export interface VacancyCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

/** Everything the office needs to settle a move-out, with the vacancy guards evaluated. */
export async function moveOutView(actor: Actor, moveOutId: string) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  const [ledger, deposits, checklists, roomBilling, reading, damages] = await Promise.all([
    loadTenantLedger(prisma, tenant.id, today()),
    depositSummary(tenant.id),
    checklistsFor(tenant.id),
    prisma.roomBilling.findUnique({ where: { unitId: tenant.unitId } }),
    mo.finalReadingId ? prisma.meterReading.findUnique({ where: { id: mo.finalReadingId } }) : null,
    prisma.charge.findMany({ where: { tenantId: tenant.id, type: "DAMAGE", sourceId: mo.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const checklist = checklists.find((c) => c.kind === "MOVE_OUT") ?? null;
  const missing = checklist ? openRequired(checklist.items) : ["Move-out checklist not started"];
  const needsReading = !!roomBilling?.meterId;
  const checks: VacancyCheck[] = [
    { label: "Required move-out checklist items done", ok: missing.length === 0, detail: missing.join("; ") || undefined },
    { label: "Security deposit settled", ok: deposits.balances.SECURITY_DEPOSIT === 0, detail: deposits.balances.SECURITY_DEPOSIT ? `${(deposits.balances.SECURITY_DEPOSIT / 100).toFixed(2)} still held` : undefined },
    { label: "Advance rent settled", ok: deposits.balances.ADVANCE_RENT === 0, detail: deposits.balances.ADVANCE_RENT ? `${(deposits.balances.ADVANCE_RENT / 100).toFixed(2)} still held` : undefined },
    { label: needsReading ? "Final water meter reading recorded" : "Final water meter reading (room has no meter)", ok: !needsReading || (!!reading && reading.status === "ACTIVE") },
  ];
  return {
    moveOut: mo,
    tenant,
    ledger: { outstandingCentavos: ledger.outstandingCentavos, creditCentavos: ledger.creditCentavos },
    deposits,
    checklist,
    finalReading: reading,
    damages,
    checks,
    balanceOk: ledger.outstandingCentavos === 0,
  };
}

/** Approve the vacancy: end the tenancy and free the room. */
export async function approveVacancy(actor: Actor, moveOutId: string, input: { actualDate?: unknown; outstandingNote?: unknown }) {
  const view = await moveOutView(actor, moveOutId);
  const { moveOut: mo, tenant } = view;
  requireOpen(mo);
  const actualDate = requireDate(input.actualDate, "Actual move-out date");
  if (actualDate < toDateOnly(tenant.moveInDate)) throw invalid("Move-out can't be before the move-in date");
  if (actualDate > today()) throw invalid("Approve the vacancy on or after the day the tenant leaves");
  const failing = view.checks.filter((c) => !c.ok);
  if (failing.length) throw invalid(`Not ready yet: ${failing.map((c) => c.label + (c.detail ? ` (${c.detail})` : "")).join("; ")}`);
  const note = optionalText(input.outstandingNote, 500);
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    // Re-check the money under the lock: a payment or charge may have landed meanwhile.
    const ledger = await loadTenantLedger(tx, tenant.id);
    if (ledger.outstandingCentavos > 0 && !note) throw invalid(`The tenant still owes ${(ledger.outstandingCentavos / 100).toFixed(2)}. Settle it, or record why the balance stays open.`);
    const held = await tx.depositTransaction.aggregate({ where: { tenantId: tenant.id }, _sum: { amountCentavos: true } });
    if ((held._sum.amountCentavos ?? 0) !== 0) throw conflict("Deposit money is still held — settle it first");
    const claimed = await tx.moveOut.updateMany({
      where: { id: mo.id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", actualDate: toDbDate(actualDate), vacancyApprovedAt: new Date(), vacancyApprovedBy: actor.id, outstandingAtCloseCentavos: ledger.outstandingCentavos, outstandingNote: ledger.outstandingCentavos > 0 ? note : null },
    });
    if (claimed.count === 0) throw conflict("This move-out was already completed");
    await tx.tenant.update({ where: { id: tenant.id }, data: { isActive: false, moveOutDate: toDbDate(actualDate) } });
    await tx.occupant.updateMany({ where: { tenantId: tenant.id, movedOutOn: null }, data: { movedOutOn: toDbDate(actualDate) } });
    const others = await tx.tenant.count({ where: { unitId: tenant.unitId, isActive: true, id: { not: tenant.id } } });
    if (others === 0) await tx.unit.update({ where: { id: tenant.unitId }, data: { status: "vacant" } });
    await audit(tx, actor, {
      entityType: "MoveOut",
      entityId: mo.id,
      action: "vacancy_approved",
      propertyId: mo.propertyId,
      tenantId: tenant.id,
      details: { actualDate, outstandingCentavos: ledger.outstandingCentavos, note },
    });
    return tx.moveOut.findUniqueOrThrow({ where: { id: mo.id } });
  });
}

export async function cancelMoveOut(actor: Actor, moveOutId: string, reasonRaw: unknown) {
  const { mo, tenant } = await adminMoveOut(actor, moveOutId);
  requireOpen(mo);
  const reason = requireText(reasonRaw, "Reason", 300);
  return inTransaction(async (tx) => {
    const saved = await tx.moveOut.update({ where: { id: mo.id }, data: { status: "CANCELLED", cancelledReason: reason } });
    await audit(tx, actor, { entityType: "MoveOut", entityId: mo.id, action: "moveout_cancelled", propertyId: mo.propertyId, tenantId: tenant.id, details: { reason } });
    return saved;
  });
}

export function moveOutDates(mo: { plannedDate: Date; actualDate: Date | null; noticeDate: Date | null }) {
  return { planned: fromDbDate(mo.plannedDate), actual: mo.actualDate ? fromDbDate(mo.actualDate) : null, notice: mo.noticeDate ? fromDbDate(mo.noticeDate) : null };
}
