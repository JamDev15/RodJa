import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./actor";

export type Tx = Prisma.TransactionClient;

/**
 * Serialize every money-moving operation for one tenant (approve, reverse,
 * waive, publish, generate). Transaction-scoped advisory lock: released on
 * commit/rollback and safe behind the Supabase transaction pooler.
 */
export async function lockTenant(tx: Tx, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"collections:tenant:" + tenantId}))`;
}

export async function lockKey(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"collections:" + key}))`;
}

export function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { timeout: 20000, maxWait: 10000 });
}

export async function audit(
  tx: Tx,
  actor: Actor,
  entry: {
    entityType: string;
    entityId: string;
    action: string;
    propertyId?: string | null;
    tenantId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.billingAuditLog.create({
    data: {
      accountId: actor.accountId,
      propertyId: entry.propertyId ?? null,
      tenantId: entry.tenantId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: actor.id,
      actorRole: actor.role,
      details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Atomically take the next number from a per-property counter. */
export async function nextNumber(tx: Tx, propertyId: string, which: "statement" | "receipt"): Promise<{ prefix: string; seq: number }> {
  const field = which === "statement" ? "nextStatementNumber" : "nextReceiptNumber";
  const updated = await tx.billingProfile.update({
    where: { propertyId },
    data: { [field]: { increment: 1 } },
    select: { nextStatementNumber: true, nextReceiptNumber: true, statementPrefix: true, receiptPrefix: true },
  });
  return which === "statement"
    ? { prefix: updated.statementPrefix, seq: updated.nextStatementNumber - 1 }
    : { prefix: updated.receiptPrefix, seq: updated.nextReceiptNumber - 1 };
}
