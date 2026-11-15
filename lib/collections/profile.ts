import { z } from "zod";
import { Prisma, type BillingProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminProperty, type Actor } from "./actor";
import { SUPPORTED_TIMEZONES, validateCycles, type CycleConfig, type ScheduleConfig } from "./calendar";
import { audit, inTransaction } from "./db";
import { invalid, notFound } from "./errors";
import { penaltyConfigProblem } from "./penalties";
import { readUpload, storeFile } from "./files";

export const DEFAULT_CYCLES: CycleConfig[] = [
  { key: "A", day: 15 },
  { key: "B", day: 30 },
];

export function scheduleOf(p: Pick<BillingProfile, "cycles" | "shortMonthPolicy" | "generateDaysBefore" | "distributeDaysBefore" | "dueDaysAfter">): ScheduleConfig {
  return {
    cycles: p.cycles as unknown as CycleConfig[],
    shortMonthPolicy: p.shortMonthPolicy as ScheduleConfig["shortMonthPolicy"],
    generateDaysBefore: p.generateDaysBefore,
    distributeDaysBefore: p.distributeDaysBefore,
    dueDaysAfter: p.dueDaysAfter,
  };
}

export async function getProfile(propertyId: string) {
  return prisma.billingProfile.findUnique({ where: { propertyId } });
}

export async function requireEnabledProfile(propertyId: string) {
  const p = await getProfile(propertyId);
  if (!p) throw notFound("Collections billing isn't set up for this property");
  if (!p.enabled) throw invalid("Collections billing is turned off for this property");
  return p;
}

const centavos = z.number().int().min(0).max(100_000_000);

export const profileUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  cycles: z.array(z.object({ key: z.string(), day: z.number().int() })).optional(),
  shortMonthPolicy: z.enum(["LAST_DAY", "NEXT_MONTH_FIRST"]).optional(),
  generateDaysBefore: z.number().int().min(0).max(28).optional(),
  distributeDaysBefore: z.number().int().min(-28).max(28).optional(),
  dueDaysAfter: z.number().int().min(0).max(28).optional(),
  monthlyCycleKey: z.string().regex(/^[A-Z]$/).optional(),
  autoGenerate: z.boolean().optional(),
  requireReview: z.boolean().optional(),
  waterEnabled: z.boolean().optional(),
  waterBaseCentavos: centavos.optional(),
  waterPerExtraCentavos: centavos.optional(),
  waterMaxOccupants: z.number().int().min(1).max(10).optional(),
  penaltyEnabled: z.boolean().optional(),
  penaltyRateBps: z.number().int().min(1).max(10000).nullable().optional(),
  penaltyGraceDays: z.number().int().min(0).max(60).nullable().optional(),
  meterUnitLabel: z.string().trim().min(1).max(10).optional(),
  meterAllowance: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/).nullable().optional(),
  meterExcessRateCentavos: centavos.nullable().optional(),
  meterReadingFrequency: z.string().trim().max(60).nullable().optional(),
  vecoEnabled: z.boolean().optional(),
  vecoReceiptDueDay: z.number().int().min(1).max(28).optional(),
  paymentInstructions: z.string().trim().max(2000).nullable().optional(),
  statementPrefix: z.string().trim().regex(/^[A-Z0-9-]{1,10}$/).optional(),
  receiptPrefix: z.string().trim().regex(/^[A-Z0-9-]{1,10}$/).optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/** Create (if missing) or update a property's billing profile. */
export async function upsertProfile(actor: Actor, propertyId: string, raw: ProfileUpdate) {
  const property = await adminProperty(actor, propertyId);
  const parsedUpdate = profileUpdateSchema.safeParse(raw);
  if (!parsedUpdate.success) throw invalid(parsedUpdate.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const update = parsedUpdate.data;
  const existing = await getProfile(propertyId);
  const next = { ...(existing ?? {}), ...update } as Partial<BillingProfile> & ProfileUpdate;
  const cycles = (update.cycles ?? (existing?.cycles as unknown as CycleConfig[] | undefined) ?? DEFAULT_CYCLES).map((c) => ({ key: c.key.toUpperCase(), day: c.day }));
  const cycleProblem = validateCycles(cycles);
  if (cycleProblem) throw invalid(cycleProblem);
  const monthlyKey = update.monthlyCycleKey ?? existing?.monthlyCycleKey ?? "A";
  if (!cycles.some((c) => c.key === monthlyKey)) throw invalid("The once-a-month cycle must be one of the billing cycles");
  if (existing && !SUPPORTED_TIMEZONES.includes(existing.timezone as (typeof SUPPORTED_TIMEZONES)[number])) throw invalid("Unsupported time zone");
  if (next.penaltyEnabled) {
    const problem = penaltyConfigProblem({
      penaltyEnabled: true,
      penaltyRateBps: next.penaltyRateBps ?? null,
      penaltyGraceDays: next.penaltyGraceDays ?? null,
      penaltyRepeat: existing?.penaltyRepeat ?? "ONCE",
      penaltyBasis: existing?.penaltyBasis ?? "STATEMENT_UNPAID_CHARGES",
    });
    if (problem) throw invalid(`Can't turn on late penalties: ${problem}`);
  }
  if (next.meterExcessRateCentavos != null && next.meterAllowance == null) throw invalid("Set a water allowance before an excess rate");

  const data = {
    ...update,
    cycles: cycles as unknown as Prisma.InputJsonValue,
    meterAllowance: update.meterAllowance === undefined ? undefined : update.meterAllowance === null ? null : new Prisma.Decimal(update.meterAllowance),
  };

  return inTransaction(async (tx) => {
    const saved = existing
      ? await tx.billingProfile.update({ where: { propertyId }, data })
      : await tx.billingProfile.create({ data: { ...data, accountId: property.accountId, propertyId, cycles: data.cycles } });
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(update)) {
      const before = existing ? (existing as unknown as Record<string, unknown>)[k] : undefined;
      if (JSON.stringify(before) !== JSON.stringify(v)) changed[k] = { from: before ?? null, to: v };
    }
    await audit(tx, actor, { entityType: "BillingProfile", entityId: saved.id, action: existing ? "settings_updated" : "settings_created", propertyId, details: changed });
    return saved;
  });
}

/** Upload the logo printed on this property's statements. */
export async function setLogo(actor: Actor, propertyId: string, file: File | null) {
  const property = await adminProperty(actor, propertyId);
  const profile = await getProfile(propertyId);
  if (!profile) throw notFound("Set up billing for this property first");
  const upload = await readUpload(file);
  if (upload.kind.mime === "application/pdf") throw invalid("Upload the logo as an image (JPG, PNG or WEBP)");
  const stored = await storeFile({ actor, accountId: property.accountId, propertyId, tenantId: null, purpose: "PROPERTY_LOGO", file: file! }, upload);
  return inTransaction(async (tx) => {
    await tx.billingProfile.update({ where: { propertyId }, data: { logoFileId: stored.id } });
    await audit(tx, actor, { entityType: "BillingProfile", entityId: profile.id, action: "logo_updated", propertyId, details: { fileId: stored.id } });
    return { logoFileId: stored.id };
  });
}
