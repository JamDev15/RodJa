// Statement generation (drafts), draft review edits, and publication.
//
// Safety properties:
//  - one statement per tenancy per cycle: Statement @@unique([tenantId, periodKey]);
//  - one charge per source per tenant: Charge @@unique([tenantId, sourceKey])
//    + createMany({ skipDuplicates }) — reruns and concurrent runs add nothing;
//  - all work for a tenant runs under that tenant's advisory lock;
//  - published statements are never modified; corrections are adjustments.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminProperty, requireAdmin, type Actor } from "./actor";
import {
  cycleSchedule,
  dateIn,
  fromDbDate,
  isValidDate,
  parsePeriodKey,
  toDbDate,
  todayIn,
  type CycleSchedule,
} from "./calendar";
import { audit, inTransaction, lockTenant, nextNumber, type Tx } from "./db";
import { conflict, invalid, notFound } from "./errors";
import { applyCredits, loadTenantLedger } from "./ledger";
import { assessPenalty } from "./penalties";
import { CHARGE_LABELS, planCycleCharges, type ChargeType, type RecurringChargeInput } from "./plan";
import { requireEnabledProfile, scheduleOf } from "./profile";
import { computeStatementTotals } from "./statement-math";

type Profile = Awaited<ReturnType<typeof requireEnabledProfile>>;

export interface TenantGenerationResult {
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  statementId: string | null;
  outcome: "created" | "updated" | "unchanged" | "already_published";
  chargesAdded: number;
  notes: string[];
}

/** Tenancies that overlap the cycle's service period. */
async function tenanciesForPeriod(propertyId: string, s: CycleSchedule, timezone: string) {
  const tenants = await prisma.tenant.findMany({
    where: { unit: { propertyId } },
    include: { unit: { include: { roomBilling: true, recurringCharges: true } } },
    orderBy: [{ unit: { unitNumber: "asc" } }, { moveInDate: "asc" }],
  });
  return tenants.filter((t) => {
    const moveIn = dateIn(timezone, t.moveInDate);
    if (moveIn > s.periodEnd) return false;
    if (t.moveOutDate) return dateIn(timezone, t.moveOutDate) >= s.periodStart;
    return t.isActive;
  });
}

async function generateForTenant(
  tx: Tx,
  actor: Actor,
  profile: Profile,
  s: CycleSchedule,
  tenant: Awaited<ReturnType<typeof tenanciesForPeriod>>[number],
  today: string,
): Promise<TenantGenerationResult> {
  await lockTenant(tx, tenant.id);
  const base = { tenantId: tenant.id, tenantName: tenant.name, unitNumber: tenant.unit.unitNumber };

  let statement = await tx.statement.findUnique({ where: { tenantId_periodKey: { tenantId: tenant.id, periodKey: s.periodKey } } });
  if (statement?.status === "PUBLISHED") return { ...base, statementId: statement.id, outcome: "already_published", chargesAdded: 0, notes: [] };

  const created = !statement;
  if (!statement) {
    statement = await tx.statement.create({
      data: {
        accountId: profile.accountId,
        propertyId: profile.propertyId,
        unitId: tenant.unitId,
        tenantId: tenant.id,
        periodKey: s.periodKey,
        cycleKey: s.key,
        billingMonth: s.month,
        cycleDate: toDbDate(s.cycleDate),
        periodStart: toDbDate(s.periodStart),
        periodEnd: toDbDate(s.periodEnd),
        generateOn: toDbDate(s.generateOn),
        distributeOn: toDbDate(s.distributeOn),
        dueDate: toDbDate(s.dueDate),
        createdBy: actor.id,
      },
    });
  }

  const room = tenant.unit.roomBilling;
  const plan = planCycleCharges({
    cycle: s,
    monthlyCycleKey: profile.monthlyCycleKey,
    recurring: tenant.unit.recurringCharges.map((r) => r as unknown as RecurringChargeInput),
    water: profile,
    occupantCount: tenant.occupantCount,
    waterOverride: room?.waterOverrideCentavos != null ? { amountCentavos: room.waterOverrideCentavos, reason: room.waterOverrideReason ?? "" } : null,
  });

  const rows: Prisma.ChargeCreateManyInput[] = plan.charges.map((c) => ({
    accountId: profile.accountId,
    propertyId: profile.propertyId,
    unitId: tenant.unitId,
    tenantId: tenant.id,
    statementId: statement!.id,
    type: c.type,
    description: c.description,
    amountCentavos: c.amountCentavos,
    billingMonth: s.month,
    periodKey: s.periodKey,
    dueDate: toDbDate(s.dueDate),
    sourceKey: c.sourceKey,
    sourceId: c.sourceId,
    calc: (c.calc ?? undefined) as Prisma.InputJsonValue | undefined,
    status: "DRAFT",
    createdBy: actor.id,
  }));

  // Late penalties on this tenant's earlier issued statements (once each).
  const earlier = await tx.statement.findMany({
    where: { tenantId: tenant.id, status: "PUBLISHED", dueDate: { lt: toDbDate(today) } },
    select: { id: true, dueDate: true, number: true },
  });
  if (earlier.length > 0) {
    const ledger = await loadTenantLedger(tx, tenant.id);
    for (const st of earlier) {
      const unpaid = ledger.charges.filter((c) => c.statementId === st.id && c.type !== "PENALTY").reduce((sum, c) => sum + c.outstandingCentavos, 0);
      const decision = assessPenalty(profile, { statementId: st.id, dueDate: fromDbDate(st.dueDate), unpaidNonPenaltyCentavos: unpaid, tenantExempt: tenant.penaltyExempt }, today);
      if (!decision.apply) continue;
      rows.push({
        accountId: profile.accountId,
        propertyId: profile.propertyId,
        unitId: tenant.unitId,
        tenantId: tenant.id,
        statementId: statement.id,
        type: "PENALTY",
        description: `Late penalty — statement ${st.number ?? ""}`.trim(),
        amountCentavos: decision.amountCentavos,
        billingMonth: s.month,
        periodKey: s.periodKey,
        dueDate: toDbDate(s.dueDate),
        sourceKey: decision.sourceKey,
        sourceId: st.id,
        calc: decision.calc as Prisma.InputJsonValue,
        status: "DRAFT",
        createdBy: actor.id,
      });
    }
  }

  // Approved water-excess proposals not yet on any bill.
  const excess = await tx.waterExcessProposal.findMany({ where: { tenantId: tenant.id, status: "APPROVED", chargeId: null } });
  for (const p of excess) {
    rows.push({
      accountId: profile.accountId,
      propertyId: profile.propertyId,
      unitId: tenant.unitId,
      tenantId: tenant.id,
      statementId: statement.id,
      type: "WATER_EXCESS",
      description: `Water excess usage (${p.excessUnits.toString()} ${profile.meterUnitLabel} over allowance)`,
      amountCentavos: p.proposedCentavos,
      billingMonth: s.month,
      periodKey: s.periodKey,
      dueDate: toDbDate(s.dueDate),
      sourceKey: `excess:${p.id}`,
      sourceId: p.id,
      calc: { usage: p.usage.toString(), allowance: p.allowance.toString(), rateCentavos: p.rateCentavos } as Prisma.InputJsonValue,
      status: "DRAFT",
      createdBy: actor.id,
    });
  }

  const inserted = rows.length ? await tx.charge.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };

  for (const p of excess) {
    const charge = await tx.charge.findUnique({ where: { tenantId_sourceKey: { tenantId: tenant.id, sourceKey: `excess:${p.id}` } }, select: { id: true } });
    if (charge) await tx.waterExcessProposal.updateMany({ where: { id: p.id, chargeId: null }, data: { chargeId: charge.id } });
  }

  if (created || inserted.count > 0) {
    await audit(tx, actor, {
      entityType: "Statement",
      entityId: statement.id,
      action: created ? "draft_generated" : "draft_refreshed",
      propertyId: profile.propertyId,
      tenantId: tenant.id,
      details: { periodKey: s.periodKey, chargesAdded: inserted.count, notes: plan.notes },
    });
  }
  return { ...base, statementId: statement.id, outcome: created ? "created" : inserted.count > 0 ? "updated" : "unchanged", chargesAdded: inserted.count, notes: plan.notes };
}

/** Create or top up draft statements for every tenancy in the cycle. Safe to rerun. */
export async function generateStatements(actor: Actor, propertyId: string, periodKey: string, opts: { now?: Date } = {}) {
  await adminProperty(actor, propertyId);
  const profile = await requireEnabledProfile(propertyId);
  if (!parsePeriodKey(periodKey)) throw invalid("Invalid billing period");
  const s = cycleSchedule(scheduleOf(profile), periodKey);
  if (!s) throw invalid("That cycle isn't configured for this property");
  const today = todayIn(profile.timezone, opts.now);
  const tenancies = await tenanciesForPeriod(propertyId, s, profile.timezone);
  const results: TenantGenerationResult[] = [];
  for (const t of tenancies) {
    results.push(await inTransaction((tx) => generateForTenant(tx, actor, profile, s, t, today)));
  }
  return { schedule: s, results };
}

async function adminStatement(actor: Actor, statementId: string) {
  requireAdmin(actor);
  const st = await prisma.statement.findFirst({ where: { id: statementId, accountId: actor.accountId } });
  if (!st) throw notFound("Statement not found");
  return st;
}

/** Add an as-needed miscellaneous charge to a draft (description required). */
export async function addDraftCharge(actor: Actor, statementId: string, input: { type: "MISC" | "PARKING"; description: string; amountCentavos: number }) {
  const st = await adminStatement(actor, statementId);
  const description = input.description?.trim();
  if (!description) throw invalid("A description is required");
  if (!Number.isInteger(input.amountCentavos) || input.amountCentavos <= 0) throw invalid("Amount must be more than zero");
  return inTransaction(async (tx) => {
    await lockTenant(tx, st.tenantId);
    const fresh = await tx.statement.findUniqueOrThrow({ where: { id: st.id } });
    if (fresh.status !== "DRAFT") throw conflict("This statement has already been issued — add the charge to the next one");
    const charge = await tx.charge.create({
      data: {
        accountId: st.accountId,
        propertyId: st.propertyId,
        unitId: st.unitId,
        tenantId: st.tenantId,
        statementId: st.id,
        type: input.type,
        description: description.slice(0, 200),
        amountCentavos: input.amountCentavos,
        billingMonth: st.billingMonth,
        periodKey: st.periodKey,
        dueDate: st.dueDate,
        sourceKey: `manual:${crypto.randomUUID()}`,
        status: "DRAFT",
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "Charge", entityId: charge.id, action: "draft_charge_added", propertyId: st.propertyId, tenantId: st.tenantId, details: input });
    return charge;
  });
}

/** Remove a line from a draft (it was never issued, so nothing is owed). */
export async function removeDraftCharge(actor: Actor, chargeId: string) {
  requireAdmin(actor);
  const charge = await prisma.charge.findFirst({ where: { id: chargeId, accountId: actor.accountId } });
  if (!charge) throw notFound("Charge not found");
  return inTransaction(async (tx) => {
    await lockTenant(tx, charge.tenantId);
    const fresh = await tx.charge.findUniqueOrThrow({ where: { id: chargeId } });
    if (fresh.status !== "DRAFT") throw conflict("Issued charges can't be removed — waive or reduce them instead");
    await tx.waterExcessProposal.updateMany({ where: { chargeId }, data: { chargeId: null } });
    await tx.charge.delete({ where: { id: chargeId } });
    await audit(tx, actor, {
      entityType: "Charge",
      entityId: chargeId,
      action: "draft_charge_removed",
      propertyId: charge.propertyId,
      tenantId: charge.tenantId,
      details: { type: charge.type, description: charge.description, amountCentavos: charge.amountCentavos, statementId: charge.statementId },
    });
  });
}

/** Throw away a draft statement and its draft lines. */
export async function discardDraft(actor: Actor, statementId: string) {
  const st = await adminStatement(actor, statementId);
  return inTransaction(async (tx) => {
    await lockTenant(tx, st.tenantId);
    const fresh = await tx.statement.findUniqueOrThrow({ where: { id: st.id } });
    if (fresh.status !== "DRAFT") throw conflict("Issued statements can't be discarded");
    const charges = await tx.charge.findMany({ where: { statementId: st.id } });
    if (charges.some((c) => c.status !== "DRAFT")) throw conflict("Statement has issued charges");
    await tx.waterExcessProposal.updateMany({ where: { chargeId: { in: charges.map((c) => c.id) } }, data: { chargeId: null } });
    await tx.charge.deleteMany({ where: { statementId: st.id, status: "DRAFT" } });
    await tx.statement.delete({ where: { id: st.id } });
    await audit(tx, actor, { entityType: "Statement", entityId: st.id, action: "draft_discarded", propertyId: st.propertyId, tenantId: st.tenantId, details: { periodKey: st.periodKey, lines: charges.length } });
  });
}

/**
 * Issue a draft: post its charges to the ledger, apply any unapplied credit
 * oldest-first, and freeze a snapshot of exactly what the statement said.
 * Publishing twice is a no-op.
 */
export async function publishStatement(actor: Actor, statementId: string) {
  const st = await adminStatement(actor, statementId);
  const profile = await requireEnabledProfile(st.propertyId);
  return inTransaction(async (tx) => {
    await lockTenant(tx, st.tenantId);
    const claimed = await tx.statement.updateMany({ where: { id: st.id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedBy: actor.id } });
    if (claimed.count === 0) return { alreadyPublished: true, statement: await tx.statement.findUniqueOrThrow({ where: { id: st.id } }) };

    const { prefix, seq } = await nextNumber(tx, st.propertyId, "statement");
    const number = `${prefix}-${st.billingMonth.replace("-", "")}-${String(seq).padStart(5, "0")}`;
    await tx.charge.updateMany({ where: { statementId: st.id, status: "DRAFT" }, data: { status: "POSTED", postedAt: new Date() } });
    await applyCredits(tx, st.tenantId);

    const ledger = await loadTenantLedger(tx, st.tenantId);
    const lines = ledger.charges.filter((c) => c.statementId === st.id);
    const previousOutstanding = ledger.charges.filter((c) => c.statementId !== st.id).reduce((s, c) => s + c.outstandingCentavos, 0);
    const totals = computeStatementTotals({ lines, previousOutstandingCentavos: previousOutstanding, unappliedCreditCentavos: ledger.creditCentavos });

    const [tenant, property] = await Promise.all([
      tx.tenant.findUniqueOrThrow({ where: { id: st.tenantId }, include: { unit: { include: { roomBilling: true } } } }),
      tx.property.findUniqueOrThrow({ where: { id: st.propertyId } }),
    ]);
    const snapshot = {
      version: 1,
      number,
      property: { name: property.name, address: property.address, logoFileId: profile.logoFileId },
      tenant: { name: tenant.name, room: tenant.unit.unitNumber },
      periodKey: st.periodKey,
      cycleDate: fromDbDate(st.cycleDate),
      periodStart: fromDbDate(st.periodStart),
      periodEnd: fromDbDate(st.periodEnd),
      dueDate: fromDbDate(st.dueDate),
      lines: lines.map((l) => ({ chargeId: l.id, type: l.type, label: CHARGE_LABELS[l.type as ChargeType] ?? l.type, description: l.description, amountCentavos: l.grossCentavos })),
      totals,
      paymentInstructions: profile.paymentInstructions,
      issuedAt: new Date().toISOString(),
    };
    const statement = await tx.statement.update({
      where: { id: st.id },
      data: {
        number,
        previousBalanceCentavos: totals.previousBalanceCentavos,
        unappliedCreditCentavos: totals.unappliedCreditCentavos,
        currentChargesCentavos: totals.currentChargesCentavos,
        penaltiesCentavos: totals.penaltiesCentavos,
        totalDueCentavos: totals.totalDueCentavos,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await audit(tx, actor, { entityType: "Statement", entityId: st.id, action: "published", propertyId: st.propertyId, tenantId: st.tenantId, details: { number, totals } });
    return { alreadyPublished: false, statement };
  });
}

/** Publish every draft of a period for a property. */
export async function publishPeriod(actor: Actor, propertyId: string, periodKey: string) {
  await adminProperty(actor, propertyId);
  const drafts = await prisma.statement.findMany({ where: { propertyId, periodKey, status: "DRAFT" }, select: { id: true } });
  const results = [];
  for (const d of drafts) results.push(await publishStatement(actor, d.id));
  return results;
}

export function validPeriodKeyOrThrow(periodKey: string) {
  if (!parsePeriodKey(periodKey)) throw invalid("Invalid billing period");
}

export function validDateOrThrow(date: string, label = "Date") {
  if (!isValidDate(date)) throw invalid(`${label} must be YYYY-MM-DD`);
}
