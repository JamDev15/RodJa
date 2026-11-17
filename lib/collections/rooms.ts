// Per-room billing setup: recurring charges, occupants, meter id, VECO
// account, water override, per-tenant penalty exemption, opening balances.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "./actor";
import { isValidMonth, toDbDate, todayIn } from "./calendar";
import { applyCredits } from "./ledger";
import { audit, inTransaction, lockTenant } from "./db";
import { invalid, notFound } from "./errors";
import { getProfile } from "./profile";

async function adminUnit(actor: Actor, unitId: string) {
  requireAdmin(actor);
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { accountId: actor.accountId } }, include: { property: true } });
  if (!unit) throw notFound("Room not found");
  return unit;
}

async function adminTenant(actor: Actor, tenantId: string) {
  requireAdmin(actor);
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: { include: { property: true } } } });
  if (!tenant) throw notFound("Tenant not found");
  return tenant;
}

export const recurringChargeSchema = z
  .object({
    type: z.enum(["RENT", "INTERNET", "PARKING", "OTHER"]),
    description: z.string().trim().min(1, "Description is required").max(120),
    amountCentavos: z.number().int().min(1, "Amount must be more than zero").max(100_000_000),
    amountBasis: z.enum(["PER_OCCURRENCE", "PER_CYCLE", "MONTHLY_SPLIT"]),
    frequency: z.enum(["EVERY_CYCLE", "MONTHLY", "EVERY_N_MONTHS"]),
    intervalMonths: z.number().int().min(1).max(12).default(1),
    cycleKey: z.string().regex(/^[A-Z]$/).nullable().optional(),
    startMonth: z.string().refine(isValidMonth, "Start month must be YYYY-MM"),
    endMonth: z.string().refine(isValidMonth, "End month must be YYYY-MM").nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "RENT") {
      if (v.frequency !== "EVERY_CYCLE") ctx.addIssue({ code: "custom", message: "Rent is billed every cycle" });
      if (v.amountBasis !== "PER_CYCLE" && v.amountBasis !== "MONTHLY_SPLIT")
        ctx.addIssue({ code: "custom", message: "Choose whether the rent amount is per cycle or the monthly total" });
    } else if (v.amountBasis === "MONTHLY_SPLIT") {
      ctx.addIssue({ code: "custom", message: "Only rent can be split across cycles" });
    }
    if (v.type === "INTERNET" && v.frequency !== "MONTHLY") ctx.addIssue({ code: "custom", message: "Internet is billed monthly" });
    if (v.endMonth && v.endMonth < v.startMonth) ctx.addIssue({ code: "custom", message: "End month is before start month" });
  });

export async function addRecurringCharge(actor: Actor, unitId: string, raw: z.input<typeof recurringChargeSchema>) {
  const unit = await adminUnit(actor, unitId);
  const parsed = recurringChargeSchema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error.issues.map((i) => i.message).join("; "));
  const input = parsed.data;
  const profile = await getProfile(unit.propertyId);
  if (input.cycleKey && profile && !(profile.cycles as { key: string }[]).some((c) => c.key === input.cycleKey)) throw invalid("Unknown billing cycle");
  return inTransaction(async (tx) => {
    const rc = await tx.recurringCharge.create({
      data: { ...input, cycleKey: input.cycleKey ?? null, endMonth: input.endMonth ?? null, accountId: unit.property.accountId, propertyId: unit.propertyId, unitId, createdBy: actor.id },
    });
    await audit(tx, actor, { entityType: "RecurringCharge", entityId: rc.id, action: "recurring_created", propertyId: unit.propertyId, details: input });
    return rc;
  });
}

/**
 * Changing a recurring charge never touches charges already generated or
 * issued: those keep their own amount. To change an amount from a given
 * month, end the old charge and add a new one (endAndReplace), so the
 * history of what was billed when stays readable.
 */
export async function endRecurringCharge(actor: Actor, recurringId: string, endMonth: string | null) {
  requireAdmin(actor);
  const rc = await prisma.recurringCharge.findFirst({ where: { id: recurringId, accountId: actor.accountId } });
  if (!rc) throw notFound("Recurring charge not found");
  if (endMonth && (!isValidMonth(endMonth) || endMonth < rc.startMonth)) throw invalid("Invalid end month");
  return inTransaction(async (tx) => {
    const updated = await tx.recurringCharge.update({ where: { id: rc.id }, data: endMonth ? { endMonth } : { isActive: false } });
    await audit(tx, actor, { entityType: "RecurringCharge", entityId: rc.id, action: endMonth ? "recurring_ended" : "recurring_disabled", propertyId: rc.propertyId, details: { endMonth } });
    return updated;
  });
}

export const roomSettingsSchema = z.object({
  meterId: z.string().trim().max(60).nullable().optional(),
  vecoAccountNumber: z.string().trim().max(60).nullable().optional(),
  waterOverrideCentavos: z.number().int().min(0).max(10_000_000).nullable().optional(),
  waterOverrideReason: z.string().trim().max(300).nullable().optional(),
});

export async function updateRoomSettings(actor: Actor, unitId: string, raw: z.input<typeof roomSettingsSchema>) {
  const unit = await adminUnit(actor, unitId);
  const parsedInput = roomSettingsSchema.safeParse(raw);
  if (!parsedInput.success) throw invalid(parsedInput.error.issues.map((i) => i.message).join("; "));
  const input = parsedInput.data;
  if (input.waterOverrideCentavos != null && !input.waterOverrideReason) throw invalid("A reason is required to override the water charge");
  const before = await prisma.roomBilling.findUnique({ where: { unitId } });
  const overrideChanged = input.waterOverrideCentavos !== undefined && input.waterOverrideCentavos !== before?.waterOverrideCentavos;
  const data = {
    ...input,
    meterId: input.meterId === "" ? null : input.meterId,
    vecoAccountNumber: input.vecoAccountNumber === "" ? null : input.vecoAccountNumber,
    ...(input.waterOverrideCentavos === null ? { waterOverrideReason: null } : {}),
    ...(overrideChanged ? { waterOverrideBy: actor.id, waterOverrideAt: new Date() } : {}),
  };
  return inTransaction(async (tx) => {
    const saved = await tx.roomBilling.upsert({ where: { unitId }, update: data, create: { unitId, ...data } });
    await audit(tx, actor, { entityType: "RoomBilling", entityId: saved.id, action: overrideChanged ? "water_override_changed" : "room_settings_updated", propertyId: unit.propertyId, details: { before, after: input } });
    return saved;
  });
}

export const tenantBillingSchema = z.object({
  occupantCount: z.number().int().min(1).max(4).nullable().optional(),
  penaltyExempt: z.boolean().optional(),
  penaltyExemptReason: z.string().trim().max(300).nullable().optional(),
});

export async function updateTenantBilling(actor: Actor, tenantId: string, raw: z.input<typeof tenantBillingSchema>) {
  const tenant = await adminTenant(actor, tenantId);
  const parsedInput = tenantBillingSchema.safeParse(raw);
  if (!parsedInput.success) throw invalid(parsedInput.error.issues.map((i) => i.message).join("; "));
  const input = parsedInput.data;
  if (input.penaltyExempt && !input.penaltyExemptReason) throw invalid("A reason is required for a penalty exemption");
  const profile = await getProfile(tenant.unit.propertyId);
  if (input.occupantCount != null && profile && input.occupantCount > profile.waterMaxOccupants) throw invalid(`At most ${profile.waterMaxOccupants} occupants per room`);
  return inTransaction(async (tx) => {
    const saved = await tx.tenant.update({
      where: { id: tenantId },
      data: { ...input, ...(input.penaltyExempt === false ? { penaltyExemptReason: null } : {}) },
      select: { id: true, occupantCount: true, penaltyExempt: true, penaltyExemptReason: true },
    });
    await audit(tx, actor, {
      entityType: "Tenant",
      entityId: tenantId,
      action: "tenant_billing_updated",
      propertyId: tenant.unit.propertyId,
      tenantId,
      details: { before: { occupantCount: tenant.occupantCount, penaltyExempt: tenant.penaltyExempt }, after: input },
    });
    return saved;
  });
}

/**
 * Bring a tenant's existing debt (from the old monthly ledger, a spreadsheet,
 * or paper records) into collections billing exactly once. It's posted as a
 * single OPENING_BALANCE charge; the sourceKey makes a second one impossible.
 */
export async function recordOpeningBalance(actor: Actor, tenantId: string, input: { amountCentavos: number; asOfDate: string; description: string }) {
  const tenant = await adminTenant(actor, tenantId);
  if (!Number.isInteger(input.amountCentavos) || input.amountCentavos <= 0) throw invalid("Opening balance must be more than zero");
  if (!input.description.trim()) throw invalid("Describe where the opening balance comes from");
  const profile = await getProfile(tenant.unit.propertyId);
  const today = todayIn(profile?.timezone ?? "Asia/Manila");
  if (input.asOfDate > today) throw invalid("Opening balance date can't be in the future");
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const existing = await tx.charge.findUnique({ where: { tenantId_sourceKey: { tenantId, sourceKey: "opening" } } });
    if (existing) throw invalid("This tenant already has an opening balance. Adjust it instead of adding another.");
    const charge = await tx.charge.create({
      data: {
        accountId: tenant.unit.property.accountId,
        propertyId: tenant.unit.propertyId,
        unitId: tenant.unitId,
        tenantId,
        type: "OPENING_BALANCE",
        description: input.description.trim().slice(0, 200),
        amountCentavos: input.amountCentavos,
        billingMonth: input.asOfDate.slice(0, 7),
        dueDate: toDbDate(input.asOfDate),
        sourceKey: "opening",
        status: "POSTED",
        postedAt: new Date(),
        createdBy: actor.id,
      },
    });
    await applyCredits(tx, tenantId);
    await audit(tx, actor, { entityType: "Charge", entityId: charge.id, action: "opening_balance_recorded", propertyId: tenant.unit.propertyId, tenantId, details: input });
    return charge;
  });
}
