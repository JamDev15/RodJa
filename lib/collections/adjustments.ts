// Waivers and reductions on issued charges. Issued charges are never edited
// or deleted; a correction is a recorded negative adjustment with a reason,
// and can itself be reversed. Late penalties are waived the same way.

import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "./actor";
import { audit, inTransaction, lockTenant } from "./db";
import { conflict, invalid, notFound } from "./errors";
import { applyCredits, releaseOverAllocation } from "./ledger";

export async function adjustCharge(actor: Actor, chargeId: string, input: { kind: "WAIVER" | "REDUCTION"; amountCentavos?: number; reason: string }) {
  requireAdmin(actor);
  const reason = input.reason?.trim();
  if (!reason) throw invalid("A reason is required");
  const charge = await prisma.charge.findFirst({ where: { id: chargeId, accountId: actor.accountId } });
  if (!charge) throw notFound("Charge not found");
  return inTransaction(async (tx) => {
    await lockTenant(tx, charge.tenantId);
    const fresh = await tx.charge.findUniqueOrThrow({ where: { id: chargeId }, include: { adjustments: { where: { reversedAt: null } } } });
    if (fresh.status !== "POSTED") throw conflict("Only issued charges can be adjusted — edit the draft instead");
    const net = fresh.amountCentavos + fresh.adjustments.reduce((s, a) => s + a.amountCentavos, 0);
    const amount = input.kind === "WAIVER" ? net : input.amountCentavos ?? 0;
    if (!Number.isInteger(amount) || amount <= 0) throw invalid(input.kind === "WAIVER" ? "Nothing left to waive on this charge" : "Reduction must be more than zero");
    if (amount > net) throw invalid("A reduction can't be more than the charge");
    const adj = await tx.chargeAdjustment.create({
      data: { chargeId, accountId: fresh.accountId, tenantId: fresh.tenantId, kind: input.kind, amountCentavos: -amount, reason: reason.slice(0, 500), createdBy: actor.id },
    });
    await releaseOverAllocation(tx, chargeId, `${input.kind === "WAIVER" ? "Charge waived" : "Charge reduced"}: ${reason}`.slice(0, 1000));
    await applyCredits(tx, fresh.tenantId);
    await audit(tx, actor, {
      entityType: "Charge",
      entityId: chargeId,
      action: input.kind === "WAIVER" ? "waived" : "reduced",
      propertyId: fresh.propertyId,
      tenantId: fresh.tenantId,
      details: { amountCentavos: amount, reason, type: fresh.type, adjustmentId: adj.id },
    });
    return adj;
  });
}

export async function reverseAdjustment(actor: Actor, adjustmentId: string, reason: string) {
  requireAdmin(actor);
  const why = reason?.trim();
  if (!why) throw invalid("A reason is required");
  const adj = await prisma.chargeAdjustment.findFirst({ where: { id: adjustmentId, accountId: actor.accountId } });
  if (!adj) throw notFound("Adjustment not found");
  return inTransaction(async (tx) => {
    await lockTenant(tx, adj.tenantId);
    const claimed = await tx.chargeAdjustment.updateMany({ where: { id: adj.id, reversedAt: null }, data: { reversedAt: new Date(), reversedBy: actor.id, reversalReason: why.slice(0, 500) } });
    if (claimed.count === 0) return { alreadyReversed: true };
    await applyCredits(tx, adj.tenantId);
    await audit(tx, actor, { entityType: "ChargeAdjustment", entityId: adj.id, action: "adjustment_reversed", tenantId: adj.tenantId, details: { reason: why, chargeId: adj.chargeId } });
    return { alreadyReversed: false };
  });
}
