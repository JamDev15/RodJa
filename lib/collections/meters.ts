// Water meter readings (caretaker or admin entry) and excess-usage
// proposals (admin approval required before anything is billed).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireMeterAccess, type Actor } from "./actor";
import { dateIn, fromDbDate, isValidDate, toDbDate, todayIn } from "./calendar";
import { audit, inTransaction, lockKey, lockTenant } from "./db";
import { conflict, invalid, notFound } from "./errors";
import { getProfile } from "./profile";

const D = Prisma.Decimal;

/**
 * Excess units and proposed charge. Pure (exported for tests). Returns null
 * when no allowance or no rate is configured — the owner hasn't decided the
 * rule yet, so nothing is proposed.
 */
export function excessProposal(usage: Prisma.Decimal, allowance: Prisma.Decimal | null, rateCentavos: number | null) {
  if (allowance == null || rateCentavos == null) return null;
  if (usage.lte(allowance)) return null;
  const excessUnits = usage.minus(allowance);
  const proposedCentavos = excessUnits.mul(rateCentavos).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  return { excessUnits, proposedCentavos };
}

export interface ReadingInput {
  unitId: string;
  readingDate: string;
  value: string; // decimal text, up to 3 places
  isMeterReset?: boolean;
  notes?: string | null;
}

export async function addMeterReading(actor: Actor, input: ReadingInput) {
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId }, include: { property: true, roomBilling: true } });
  if (!unit) throw notFound("Room not found");
  await requireMeterAccess(actor, unit.propertyId);
  const profile = await getProfile(unit.propertyId);
  if (!profile?.enabled) throw invalid("Collections billing is turned off for this property");
  const meterId = unit.roomBilling?.meterId;
  if (!meterId) throw invalid("This room has no water meter ID yet — ask the administrator to add it");
  if (!isValidDate(input.readingDate)) throw invalid("Reading date must be YYYY-MM-DD");
  if (input.readingDate > todayIn(profile.timezone)) throw invalid("Reading date can't be in the future");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(input.value?.trim() ?? "")) throw invalid("Enter the meter reading as a number (up to 3 decimals)");
  const value = new D(input.value.trim());

  return inTransaction(async (tx) => {
    await lockKey(tx, `meter:${unit.id}`);
    const prev = await tx.meterReading.findFirst({ where: { unitId: unit.id, status: "ACTIVE" }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }] });
    if (prev) {
      const prevDate = fromDbDate(prev.readingDate);
      if (input.readingDate < prevDate) throw conflict(`A later reading (${prevDate}) already exists for this room. Readings must be entered in date order.`);
      if (input.readingDate === prevDate) throw conflict(`There's already a reading for ${prevDate}. Void it first if it was wrong.`);
    }
    const sameMeter = prev && prev.meterId === meterId;
    const isReset = !!input.isMeterReset || !sameMeter;
    if (prev && sameMeter && !input.isMeterReset && value.lt(prev.value)) {
      throw invalid(
        `This reading (${value.toString()}) is lower than the last one (${prev.value.toString()} on ${fromDbDate(prev.readingDate)}). If the meter was replaced or reset, tick "Meter replaced or reset".`,
      );
    }
    const usage = prev && !isReset ? value.minus(prev.value) : null;
    const allowance = profile.meterAllowance;
    const over = usage != null && allowance != null && usage.gt(allowance);

    const reading = await tx.meterReading.create({
      data: {
        accountId: unit.property.accountId,
        propertyId: unit.propertyId,
        unitId: unit.id,
        meterId,
        readingDate: toDbDate(input.readingDate),
        value,
        isMeterReset: isReset,
        previousReadingId: prev?.id ?? null,
        usage,
        overAllowance: over,
        notes: input.notes?.trim().slice(0, 500) || null,
        enteredBy: actor.id,
        enteredByRole: actor.role,
      },
    });

    let proposalId: string | null = null;
    if (usage != null) {
      const proposal = excessProposal(usage, allowance, profile.meterExcessRateCentavos);
      if (proposal && proposal.proposedCentavos > 0) {
        // The tenancy occupying the room on the reading date.
        const tenants = await tx.tenant.findMany({ where: { unitId: unit.id }, orderBy: { moveInDate: "desc" } });
        const tenant = tenants.find((t) => {
          const moveIn = dateIn(profile.timezone, t.moveInDate);
          const moveOut = t.moveOutDate ? dateIn(profile.timezone, t.moveOutDate) : null;
          return moveIn <= input.readingDate && (moveOut ? moveOut >= input.readingDate : t.isActive);
        });
        const p = await tx.waterExcessProposal.create({
          data: {
            accountId: unit.property.accountId,
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantId: tenant?.id ?? null,
            readingId: reading.id,
            usage,
            allowance: allowance!,
            excessUnits: proposal.excessUnits,
            rateCentavos: profile.meterExcessRateCentavos!,
            proposedCentavos: proposal.proposedCentavos,
          },
        });
        proposalId = p.id;
      }
    }
    await audit(tx, actor, {
      entityType: "MeterReading",
      entityId: reading.id,
      action: "reading_entered",
      propertyId: unit.propertyId,
      details: { value: value.toString(), readingDate: input.readingDate, isMeterReset: isReset, usage: usage?.toString() ?? null, overAllowance: over },
    });
    return { reading, proposalId };
  });
}

/** Admin voids a mistaken reading (only the latest, and only if nothing was billed from it). */
export async function voidMeterReading(actor: Actor, readingId: string, reason: string) {
  requireAdmin(actor);
  const why = reason?.trim();
  if (!why) throw invalid("A reason is required");
  const reading = await prisma.meterReading.findFirst({ where: { id: readingId, accountId: actor.accountId }, include: { excessProposal: true } });
  if (!reading) throw notFound("Reading not found");
  return inTransaction(async (tx) => {
    await lockKey(tx, `meter:${reading.unitId}`);
    const later = await tx.meterReading.findFirst({ where: { unitId: reading.unitId, status: "ACTIVE", readingDate: { gt: reading.readingDate } } });
    if (later) throw conflict("Only the most recent reading can be voided");
    if (reading.excessProposal?.chargeId) throw conflict("An excess charge from this reading is already on a bill — waive that charge instead");
    await tx.meterReading.update({ where: { id: reading.id }, data: { status: "VOID", voidReason: why.slice(0, 500) } });
    if (reading.excessProposal && reading.excessProposal.status !== "REJECTED") {
      await tx.waterExcessProposal.update({ where: { id: reading.excessProposal.id }, data: { status: "REJECTED", decidedBy: actor.id, decidedAt: new Date(), decisionNote: `Reading voided: ${why}`.slice(0, 500) } });
    }
    await audit(tx, actor, { entityType: "MeterReading", entityId: reading.id, action: "reading_voided", propertyId: reading.propertyId, details: { reason: why } });
  });
}

/** Approve or reject a proposed excess charge. Approved ones go on the next draft statement. */
export async function decideExcessProposal(actor: Actor, proposalId: string, decision: "APPROVE" | "REJECT", note?: string) {
  requireAdmin(actor);
  const p = await prisma.waterExcessProposal.findFirst({ where: { id: proposalId, accountId: actor.accountId } });
  if (!p) throw notFound("Proposal not found");
  if (decision === "APPROVE" && !p.tenantId) throw invalid("No tenant occupied the room on the reading date, so there's no one to bill");
  if (decision === "REJECT" && !note?.trim()) throw invalid("A reason is required to reject");
  return inTransaction(async (tx) => {
    if (p.tenantId) await lockTenant(tx, p.tenantId);
    const claimed = await tx.waterExcessProposal.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedBy: actor.id, decidedAt: new Date(), decisionNote: note?.trim().slice(0, 500) || null },
    });
    if (claimed.count === 0) throw conflict("This proposal was already decided");
    await audit(tx, actor, { entityType: "WaterExcessProposal", entityId: p.id, action: decision === "APPROVE" ? "excess_approved" : "excess_rejected", propertyId: p.propertyId, tenantId: p.tenantId, details: { proposedCentavos: p.proposedCentavos, note } });
  });
}

/** What a caretaker (or admin) sees for meter entry: rooms, meter ids, last reading. No money. */
export async function meterEntryView(actor: Actor, propertyId: string) {
  const property = await requireMeterAccess(actor, propertyId);
  const profile = await getProfile(propertyId);
  const units = await prisma.unit.findMany({
    where: { propertyId },
    orderBy: { unitNumber: "asc" },
    select: {
      id: true,
      unitNumber: true,
      roomBilling: { select: { meterId: true } },
      meterReadings: { where: { status: "ACTIVE" }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }], take: 3, select: { id: true, readingDate: true, value: true, usage: true, overAllowance: true, isMeterReset: true } },
    },
  });
  return {
    property: { id: property.id, name: property.name },
    unitLabel: profile?.meterUnitLabel ?? "m³",
    readingFrequency: profile?.meterReadingFrequency ?? null,
    rooms: units.map((u) => ({
      unitId: u.id,
      unitNumber: u.unitNumber,
      meterId: u.roomBilling?.meterId ?? null,
      recent: u.meterReadings.map((r) => ({ id: r.id, readingDate: fromDbDate(r.readingDate), value: r.value.toString(), usage: r.usage?.toString() ?? null, overAllowance: r.overAllowance, isMeterReset: r.isMeterReset })),
    })),
  };
}
