// Security deposit and advance rent, kept separate from rent receivables.
//
// Money held in a fund is not income and never appears as a payment until
// the office APPLIES it to unpaid charges. Applying creates an APPROVED
// RentPayment (method "deposit" / "advance_rent") in the same transaction,
// so collections reports see exactly the amount that became rent, on the day
// it was applied. Every movement is a row; mistakes are undone with a
// REVERSAL row, never by editing or deleting.

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { fromDbDate, toDbDate } from "@/lib/collections/calendar";
import { audit, inTransaction, lockTenant, nextNumber, type Tx } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { applyCredits, loadTenantLedger } from "@/lib/collections/ledger";
import { adminTenant, optionalText, requireDate, requireText, today } from "./common";

export type Fund = "SECURITY_DEPOSIT" | "ADVANCE_RENT";
export const FUND_LABEL: Record<Fund, string> = { SECURITY_DEPOSIT: "Security deposit", ADVANCE_RENT: "Advance rent" };
export const DEPOSIT_PAYMENT_METHODS = ["deposit", "advance_rent"] as const;

export function parseFund(v: unknown): Fund {
  if (v === "SECURITY_DEPOSIT" || v === "ADVANCE_RENT") return v;
  throw invalid("Choose security deposit or advance rent");
}

function positiveCentavos(v?: unknown, label = "Amount"): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) throw invalid(`${label} must be more than zero`);
  if (n > 100_000_000) throw invalid(`${label} is too large`);
  return n;
}

async function fundBalance(tx: Tx, tenantId: string, fund: Fund): Promise<number> {
  const agg = await tx.depositTransaction.aggregate({ where: { tenantId, fund }, _sum: { amountCentavos: true } });
  return agg._sum.amountCentavos ?? 0;
}

export async function depositSummary(tenantId: string) {
  const rows = await prisma.depositTransaction.findMany({ where: { tenantId }, orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] });
  const balance = (fund: Fund) => rows.filter((r) => r.fund === fund).reduce((s, r) => s + r.amountCentavos, 0);
  return {
    rows,
    balances: { SECURITY_DEPOSIT: balance("SECURITY_DEPOSIT"), ADVANCE_RENT: balance("ADVANCE_RENT") },
    reversedIds: new Set(rows.filter((r) => r.reversalOfId).map((r) => r.reversalOfId!)),
  };
}

/** Money received into a fund (cash, GCash, bank…). */
export async function receiveDeposit(actor: Actor, tenantId: string, input: { fund?: unknown; amountCentavos?: unknown; occurredOn?: unknown; method?: unknown; reference?: unknown; reason?: unknown }) {
  const tenant = await adminTenant(actor, tenantId);
  const fund = parseFund(input.fund);
  const amount = positiveCentavos(input.amountCentavos);
  const occurredOn = requireDate(input.occurredOn, "Date received");
  if (occurredOn > today()) throw invalid("Date received can't be in the future");
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    const row = await tx.depositTransaction.create({
      data: {
        accountId: tenant.unit.property.accountId,
        propertyId: tenant.unit.propertyId,
        tenantId,
        fund,
        kind: "RECEIVED",
        amountCentavos: amount,
        occurredOn: toDbDate(occurredOn),
        method: optionalText(input.method, 40),
        reference: optionalText(input.reference, 80),
        reason: optionalText(input.reason, 300),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "DepositTransaction", entityId: row.id, action: "deposit_received", propertyId: tenant.unit.propertyId, tenantId, details: { fund, amountCentavos: amount } });
    return row;
  });
}

/**
 * Use held money to pay unpaid charges (oldest first). Never more than the
 * fund holds or than is currently owed.
 */
export async function applyDepositToCharges(actor: Actor, tenantId: string, input: { fund?: unknown; amountCentavos?: unknown; reason?: unknown }) {
  const tenant = await adminTenant(actor, tenantId);
  const fund = parseFund(input.fund);
  const amount = positiveCentavos(input.amountCentavos);
  const reason = requireText(input.reason, "Reason", 300);
  const profile = await prisma.billingProfile.findUnique({ where: { propertyId: tenant.unit.propertyId } });
  if (!profile) throw invalid("Collections billing isn't set up for this property, so there are no charges to apply this to");
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    const held = await fundBalance(tx, tenant.id, fund);
    if (amount > held) throw conflict(`Only ${(held / 100).toFixed(2)} is held in the ${FUND_LABEL[fund].toLowerCase()}`);
    const ledger = await loadTenantLedger(tx, tenant.id);
    const owed = ledger.outstandingCentavos - ledger.creditCentavos;
    if (owed <= 0) throw conflict("Nothing is owed right now");
    if (amount > owed) throw conflict(`Only ${(owed / 100).toFixed(2)} is owed after existing credit — apply that much at most`);
    const { prefix, seq } = await nextNumber(tx, tenant.unit.propertyId, "receipt");
    const day = today();
    const payment = await tx.rentPayment.create({
      data: {
        accountId: tenant.unit.property.accountId,
        propertyId: tenant.unit.propertyId,
        unitId: tenant.unitId,
        tenantId,
        amountCentavos: amount,
        method: fund === "SECURITY_DEPOSIT" ? "deposit" : "advance_rent",
        paidOn: toDbDate(day),
        notes: `Applied from ${FUND_LABEL[fund].toLowerCase()}: ${reason}`,
        status: "APPROVED",
        source: "ADMIN",
        submittedBy: actor.id,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        receiptNumber: `${prefix}-${String(seq).padStart(6, "0")}`,
      },
    });
    const row = await tx.depositTransaction.create({
      data: {
        accountId: tenant.unit.property.accountId,
        propertyId: tenant.unit.propertyId,
        tenantId,
        fund,
        kind: "APPLIED",
        amountCentavos: -amount,
        occurredOn: toDbDate(day),
        reason,
        paymentId: payment.id,
        createdBy: actor.id,
      },
    });
    await applyCredits(tx, tenant.id);
    await audit(tx, actor, { entityType: "DepositTransaction", entityId: row.id, action: "deposit_applied", propertyId: tenant.unit.propertyId, tenantId, details: { fund, amountCentavos: amount, paymentId: payment.id, reason } });
    return { transaction: row, payment };
  });
}

/** Money paid back to the tenant, or kept by the owner with a reason (forfeit). */
export async function releaseDeposit(actor: Actor, tenantId: string, input: { fund?: unknown; kind?: unknown; amountCentavos?: unknown; occurredOn?: unknown; reason?: unknown; method?: unknown; reference?: unknown }) {
  const tenant = await adminTenant(actor, tenantId);
  const fund = parseFund(input.fund);
  const kind = input.kind === "REFUNDED" || input.kind === "FORFEITED" ? input.kind : null;
  if (!kind) throw invalid("Choose refund or forfeit");
  const amount = positiveCentavos(input.amountCentavos);
  const occurredOn = requireDate(input.occurredOn, "Date");
  const reason = requireText(input.reason, "Reason", 300);
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    const held = await fundBalance(tx, tenant.id, fund);
    if (amount > held) throw conflict(`Only ${(held / 100).toFixed(2)} is held in the ${FUND_LABEL[fund].toLowerCase()}`);
    const row = await tx.depositTransaction.create({
      data: {
        accountId: tenant.unit.property.accountId,
        propertyId: tenant.unit.propertyId,
        tenantId,
        fund,
        kind,
        amountCentavos: -amount,
        occurredOn: toDbDate(occurredOn),
        reason,
        method: optionalText(input.method, 40),
        reference: optionalText(input.reference, 80),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "DepositTransaction", entityId: row.id, action: kind === "REFUNDED" ? "deposit_refunded" : "deposit_forfeited", propertyId: tenant.unit.propertyId, tenantId, details: { fund, amountCentavos: amount, reason } });
    return row;
  });
}

/**
 * Undo one movement with an offsetting row. Undoing an APPLIED row also
 * reverses the payment it created (and its allocations) in the same
 * transaction, so the fund and the rent ledger always move together.
 */
export async function reverseDepositTransaction(actor: Actor, transactionId: string, reasonRaw: unknown) {
  const reason = requireText(reasonRaw, "Reason", 300);
  const row = await prisma.depositTransaction.findFirst({ where: { id: transactionId, accountId: actor.accountId } });
  if (!row) throw notFound("Entry not found");
  const tenant = await adminTenant(actor, row.tenantId);
  if (row.kind === "REVERSAL") throw conflict("A reversal can't itself be reversed — record a new entry instead");
  return inTransaction(async (tx) => {
    await lockTenant(tx, tenant.id);
    const already = await tx.depositTransaction.findUnique({ where: { reversalOfId: row.id } });
    if (already) return { reversal: already, alreadyReversed: true };
    if (row.kind === "RECEIVED") {
      const held = await fundBalance(tx, tenant.id, row.fund as Fund);
      if (held < row.amountCentavos) throw conflict("Part of this money has already been applied, refunded or forfeited — undo those first");
    }
    if (row.kind === "APPLIED" && row.paymentId) {
      const claimed = await tx.rentPayment.updateMany({
        where: { id: row.paymentId, status: "APPROVED" },
        data: { status: "REVERSED", reversedBy: actor.id, reversedAt: new Date(), reversalReason: `Deposit application undone: ${reason}`.slice(0, 1000) },
      });
      if (claimed.count) {
        await tx.paymentAllocation.updateMany({ where: { paymentId: row.paymentId, reversedAt: null }, data: { reversedAt: new Date(), reversalReason: `Deposit application undone: ${reason}`.slice(0, 1000) } });
      }
    }
    const reversal = await tx.depositTransaction.create({
      data: {
        accountId: row.accountId,
        propertyId: row.propertyId,
        tenantId: row.tenantId,
        fund: row.fund,
        kind: "REVERSAL",
        amountCentavos: -row.amountCentavos,
        occurredOn: toDbDate(today()),
        reason,
        reversalOfId: row.id,
        createdBy: actor.id,
      },
    });
    if (row.kind === "APPLIED") await applyCredits(tx, tenant.id);
    await audit(tx, actor, { entityType: "DepositTransaction", entityId: row.id, action: "deposit_entry_reversed", propertyId: row.propertyId, tenantId: row.tenantId, details: { kind: row.kind, amountCentavos: row.amountCentavos, reason, originalDate: fromDbDate(row.occurredOn) } });
    return { reversal, alreadyReversed: false };
  });
}
