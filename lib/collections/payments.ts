// Payment submission and verification (Pending → Approved | Rejected,
// Approved → Reversed). Only APPROVED payments reduce what's owed, through
// PaymentAllocation rows written under the tenant lock.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireTenant, type Actor } from "./actor";
import { isValidDate, toDbDate, todayIn } from "./calendar";
import { audit, inTransaction, lockTenant, nextNumber, type Tx } from "./db";
import { conflict, invalid, notFound } from "./errors";
import { readUpload, storeFile } from "./files";
import { applyCredits } from "./ledger";
import { getProfile } from "./profile";

export const PAYMENT_METHODS = ["gcash", "maya", "bank", "cash", "other"] as const;

export const paymentInputSchema = z.object({
  amountCentavos: z.number().int().min(1, "Amount must be more than zero").max(100_000_000),
  method: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().trim().max(80).nullable().optional(),
  paidOn: z.string().refine(isValidDate, "Payment date must be YYYY-MM-DD"),
  notes: z.string().trim().max(1000).nullable().optional(),
  clientRequestId: z.string().trim().min(8).max(80).nullable().optional(),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

function parsePaymentInput(raw: unknown): PaymentInput {
  const parsed = paymentInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error.issues.map((i) => i.message).join("; "));
  return parsed.data;
}

async function tenantContext(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { unit: { include: { property: true } } } });
  if (!tenant) throw notFound("Tenant not found");
  const profile = await getProfile(tenant.unit.propertyId);
  if (!profile?.enabled) throw invalid("Online statements aren't turned on for this property");
  return { tenant, profile };
}

async function guardDuplicates(tenantId: string, input: PaymentInput, proofSha256: string | null, db: Tx | typeof prisma = prisma) {
  if (input.clientRequestId) {
    const same = await db.rentPayment.findUnique({ where: { tenantId_clientRequestId: { tenantId, clientRequestId: input.clientRequestId } } });
    if (same) return same; // double-tap / retry of the same submission
  }
  if (proofSha256) {
    const reused = await db.rentPayment.findFirst({ where: { tenantId, proofSha256, status: { in: ["PENDING", "APPROVED"] } } });
    if (reused) throw conflict("This screenshot was already submitted for another payment");
  }
  if (input.referenceNumber) {
    const ref = await db.rentPayment.findFirst({
      where: { tenantId, method: input.method, referenceNumber: { equals: input.referenceNumber, mode: "insensitive" }, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (ref) throw conflict("A payment with this reference number was already submitted");
  }
  return null;
}

/** Tenant uploads proof of a full or partial payment. */
export async function submitTenantPayment(actor: Actor, raw: z.input<typeof paymentInputSchema>, proof: File | null) {
  requireTenant(actor);
  const input = parsePaymentInput(raw);
  const { tenant, profile } = await tenantContext(actor.tenantId);
  if (tenant.unit.property.accountId !== actor.accountId) throw notFound("Tenant not found");
  const today = todayIn(profile.timezone);
  if (input.paidOn > today) throw invalid("Payment date can't be in the future");
  const needsProof = input.method !== "cash";
  const upload = proof && proof.size > 0 ? await readUpload(proof) : null;
  if (needsProof && !upload) throw invalid("Please attach a screenshot or photo of your payment");

  const dup = await guardDuplicates(tenant.id, input, upload?.sha256 ?? null);
  if (dup) return { payment: dup, duplicate: true };

  const file = upload
    ? await storeFile({ actor, accountId: actor.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, purpose: "PAYMENT_PROOF", file: proof! }, upload)
    : null;

  try {
    const payment = await inTransaction(async (tx) => {
      await lockTenant(tx, tenant.id);
      // Re-check under the lock so two simultaneous uploads can't both pass.
      const raced = await guardDuplicates(tenant.id, input, file?.sha256 ?? null, tx);
      if (raced) return raced;
      const p = await tx.rentPayment.create({
        data: {
          accountId: actor.accountId,
          propertyId: tenant.unit.propertyId,
          unitId: tenant.unitId,
          tenantId: tenant.id,
          amountCentavos: input.amountCentavos,
          method: input.method,
          referenceNumber: input.referenceNumber || null,
          paidOn: toDbDate(input.paidOn),
          notes: input.notes || null,
          status: "PENDING",
          source: "TENANT",
          clientRequestId: input.clientRequestId || null,
          proofFileId: file?.id ?? null,
          proofSha256: file?.sha256 ?? null,
          submittedBy: actor.id,
        },
      });
      await audit(tx, actor, { entityType: "RentPayment", entityId: p.id, action: "submitted", propertyId: p.propertyId, tenantId: p.tenantId, details: { amountCentavos: p.amountCentavos, method: p.method } });
      return p;
    });
    return { payment, duplicate: false };
  } catch (err) {
    // Lost a race with an identical clientRequestId: return the winner.
    if (input.clientRequestId && (err as { code?: string }).code === "P2002") {
      const same = await prisma.rentPayment.findUnique({ where: { tenantId_clientRequestId: { tenantId: tenant.id, clientRequestId: input.clientRequestId } } });
      if (same) return { payment: same, duplicate: true };
    }
    throw err;
  }
}

async function adminPayment(actor: Actor, paymentId: string) {
  requireAdmin(actor);
  const p = await prisma.rentPayment.findFirst({ where: { id: paymentId, accountId: actor.accountId } });
  if (!p) throw notFound("Payment not found");
  return p;
}

/**
 * Approve a pending payment and allocate it oldest-charge-first. Atomic and
 * idempotent: approving twice (double click, two admins at once) has one
 * effect. An admin may correct the amount at approval (recorded).
 */
export async function approvePayment(actor: Actor, paymentId: string, opts: { correctedAmountCentavos?: number; note?: string } = {}) {
  const p = await adminPayment(actor, paymentId);
  if (opts.correctedAmountCentavos != null && (!Number.isInteger(opts.correctedAmountCentavos) || opts.correctedAmountCentavos <= 0)) throw invalid("Corrected amount must be more than zero");
  return inTransaction(async (tx) => {
    await lockTenant(tx, p.tenantId);
    const claimed = await tx.rentPayment.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        ...(opts.correctedAmountCentavos != null ? { amountCentavos: opts.correctedAmountCentavos } : {}),
      },
    });
    if (claimed.count === 0) {
      const current = await tx.rentPayment.findUniqueOrThrow({ where: { id: p.id } });
      if (current.status === "APPROVED") return { payment: current, alreadyApproved: true };
      throw conflict(`This payment is ${current.status.toLowerCase()} and can't be approved`);
    }
    const { prefix, seq } = await nextNumber(tx, p.propertyId, "receipt");
    const payment = await tx.rentPayment.update({ where: { id: p.id }, data: { receiptNumber: `${prefix}-${String(seq).padStart(6, "0")}` } });
    await applyCredits(tx, p.tenantId);
    await audit(tx, actor, {
      entityType: "RentPayment",
      entityId: p.id,
      action: "approved",
      propertyId: p.propertyId,
      tenantId: p.tenantId,
      details: {
        amountCentavos: payment.amountCentavos,
        ...(opts.correctedAmountCentavos != null ? { correctedFrom: p.amountCentavos } : {}),
        note: opts.note ?? null,
        receiptNumber: payment.receiptNumber,
      },
    });
    return { payment, alreadyApproved: false };
  });
}

/** Reject a pending payment. The proof and the reason are kept. */
export async function rejectPayment(actor: Actor, paymentId: string, reason: string) {
  const p = await adminPayment(actor, paymentId);
  const why = reason?.trim();
  if (!why) throw invalid("Give the tenant a reason for the rejection");
  return inTransaction(async (tx) => {
    await lockTenant(tx, p.tenantId);
    const claimed = await tx.rentPayment.updateMany({
      where: { id: p.id, status: "PENDING" },
      data: { status: "REJECTED", rejectedReason: why.slice(0, 1000), reviewedBy: actor.id, reviewedAt: new Date() },
    });
    if (claimed.count === 0) {
      const current = await tx.rentPayment.findUniqueOrThrow({ where: { id: p.id } });
      if (current.status === "REJECTED") return { payment: current, alreadyRejected: true };
      throw conflict(`This payment is ${current.status.toLowerCase()} and can't be rejected`);
    }
    await audit(tx, actor, { entityType: "RentPayment", entityId: p.id, action: "rejected", propertyId: p.propertyId, tenantId: p.tenantId, details: { reason: why } });
    return { payment: await tx.rentPayment.findUniqueOrThrow({ where: { id: p.id } }), alreadyRejected: false };
  });
}

/**
 * Undo an approved payment (bounced transfer, approved by mistake). Its
 * allocations are marked reversed — never deleted — and any other credit is
 * re-applied to what becomes outstanding again.
 */
export async function reversePayment(actor: Actor, paymentId: string, reason: string) {
  const p = await adminPayment(actor, paymentId);
  const why = reason?.trim();
  if (!why) throw invalid("A reason is required to reverse a payment");
  // Deposit/advance applications are undone from the deposit ledger, which
  // restores the fund and reverses this payment together.
  if (p.method === "deposit" || p.method === "advance_rent") throw conflict("This payment came from the deposit — undo it from the tenant's deposit ledger instead");
  return inTransaction(async (tx) => {
    await lockTenant(tx, p.tenantId);
    const claimed = await tx.rentPayment.updateMany({
      where: { id: p.id, status: "APPROVED" },
      data: { status: "REVERSED", reversedBy: actor.id, reversedAt: new Date(), reversalReason: why.slice(0, 1000) },
    });
    if (claimed.count === 0) {
      const current = await tx.rentPayment.findUniqueOrThrow({ where: { id: p.id } });
      if (current.status === "REVERSED") return { payment: current, alreadyReversed: true };
      throw conflict("Only approved payments can be reversed");
    }
    await tx.paymentAllocation.updateMany({ where: { paymentId: p.id, reversedAt: null }, data: { reversedAt: new Date(), reversalReason: `Payment reversed: ${why}`.slice(0, 1000) } });
    await applyCredits(tx, p.tenantId);
    await audit(tx, actor, { entityType: "RentPayment", entityId: p.id, action: "reversed", propertyId: p.propertyId, tenantId: p.tenantId, details: { reason: why, amountCentavos: p.amountCentavos } });
    return { payment: await tx.rentPayment.findUniqueOrThrow({ where: { id: p.id } }), alreadyReversed: false };
  });
}

/** Admin records a payment received directly (e.g. cash) and approves it. */
export async function recordAdminPayment(actor: Actor, tenantId: string, raw: z.input<typeof paymentInputSchema>) {
  requireAdmin(actor);
  const input = parsePaymentInput(raw);
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: true } });
  if (!tenant) throw notFound("Tenant not found");
  const profile = await getProfile(tenant.unit.propertyId);
  if (!profile?.enabled) throw invalid("Collections billing is turned off for this property");
  if (input.paidOn > todayIn(profile.timezone)) throw invalid("Payment date can't be in the future");
  const dup = await guardDuplicates(tenantId, input, null);
  if (dup) return { payment: dup, duplicate: true };
  const created = await inTransaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const raced = await guardDuplicates(tenantId, input, null, tx);
    if (raced) return raced;
    const p = await tx.rentPayment.create({
      data: {
        accountId: actor.accountId,
        propertyId: tenant.unit.propertyId,
        unitId: tenant.unitId,
        tenantId,
        amountCentavos: input.amountCentavos,
        method: input.method,
        referenceNumber: input.referenceNumber || null,
        paidOn: toDbDate(input.paidOn),
        notes: input.notes || null,
        status: "PENDING",
        source: "ADMIN",
        clientRequestId: input.clientRequestId || null,
        submittedBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "RentPayment", entityId: p.id, action: "recorded_by_admin", propertyId: p.propertyId, tenantId, details: { amountCentavos: p.amountCentavos, method: p.method } });
    return p;
  });
  const approved = await approvePayment(actor, created.id);
  return { payment: approved.payment, duplicate: false };
}
