// The authoritative receivable ledger for collections billing. Dashboard,
// tenant portal, statements, receipts and reports all read balances from
// here — nothing else adds charges and payments together.

import { prisma } from "@/lib/prisma";
import { allocateOldestFirst, sortOldestFirst } from "./allocation";
import { fromDbDate } from "./calendar";
import type { Tx } from "./db";
import { netOf, outstandingOf, type LineState } from "./statement-math";

export interface LedgerCharge extends LineState {
  id: string;
  statementId: string | null;
  description: string;
  billingMonth: string;
  periodKey: string | null;
  dueDate: string;
  createdAt: Date;
  postedAt: Date | null;
  netCentavos: number;
  outstandingCentavos: number;
}

export interface LedgerPayment {
  id: string;
  amountCentavos: number;
  paidOn: string;
  createdAt: Date;
  allocatedCentavos: number;
  creditCentavos: number;
}

export interface TenantLedger {
  charges: LedgerCharge[];
  payments: LedgerPayment[];
  outstandingCentavos: number;
  overdueCentavos: number;
  creditCentavos: number;
  /** Positive = owes; negative = credit balance. */
  netBalanceCentavos: number;
}

type Db = Tx | typeof prisma;

export async function loadTenantLedger(db: Db, tenantId: string, today?: string): Promise<TenantLedger> {
  const [charges, payments] = await Promise.all([
    db.charge.findMany({
      where: { tenantId, status: "POSTED" },
      include: { adjustments: { where: { reversedAt: null } }, allocations: { where: { reversedAt: null } } },
    }),
    db.rentPayment.findMany({
      where: { tenantId, status: "APPROVED" },
      include: { allocations: { where: { reversedAt: null } } },
      orderBy: [{ paidOn: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const ledgerCharges: LedgerCharge[] = charges.map((c) => {
    const line: LineState = {
      type: c.type,
      grossCentavos: c.amountCentavos,
      adjustmentsCentavos: c.adjustments.reduce((s, a) => s + a.amountCentavos, 0),
      allocatedCentavos: c.allocations.reduce((s, a) => s + a.amountCentavos, 0),
    };
    return {
      ...line,
      id: c.id,
      statementId: c.statementId,
      description: c.description,
      billingMonth: c.billingMonth,
      periodKey: c.periodKey,
      dueDate: fromDbDate(c.dueDate),
      createdAt: c.createdAt,
      postedAt: c.postedAt,
      netCentavos: netOf(line),
      outstandingCentavos: outstandingOf(line),
    };
  });

  const ledgerPayments: LedgerPayment[] = payments.map((p) => {
    const allocated = p.allocations.reduce((s, a) => s + a.amountCentavos, 0);
    return {
      id: p.id,
      amountCentavos: p.amountCentavos,
      paidOn: fromDbDate(p.paidOn),
      createdAt: p.createdAt,
      allocatedCentavos: allocated,
      creditCentavos: Math.max(0, p.amountCentavos - allocated),
    };
  });

  const outstanding = ledgerCharges.reduce((s, c) => s + c.outstandingCentavos, 0);
  const overdue = today ? ledgerCharges.filter((c) => c.dueDate < today).reduce((s, c) => s + c.outstandingCentavos, 0) : 0;
  const credit = ledgerPayments.reduce((s, p) => s + p.creditCentavos, 0);
  return {
    charges: sortOldestFirst(ledgerCharges),
    payments: ledgerPayments,
    outstandingCentavos: outstanding,
    overdueCentavos: overdue,
    creditCentavos: credit,
    netBalanceCentavos: outstanding - credit,
  };
}

/**
 * Apply every approved-but-unallocated payment to the tenant's outstanding
 * posted charges, oldest charge first, oldest payment first. Must run inside
 * a transaction holding the tenant lock. Safe to call repeatedly: once all
 * credit is applied (or nothing is outstanding) it does nothing.
 */
export async function applyCredits(tx: Tx, tenantId: string): Promise<number> {
  const ledger = await loadTenantLedger(tx, tenantId);
  const open = ledger.charges
    .filter((c) => c.outstandingCentavos > 0)
    .map((c) => ({ id: c.id, dueDate: c.dueDate, createdAt: c.createdAt, outstandingCentavos: c.outstandingCentavos }));
  let created = 0;
  for (const p of ledger.payments) {
    if (p.creditCentavos <= 0) continue;
    const { allocations } = allocateOldestFirst(open, p.creditCentavos);
    for (const a of allocations) {
      await tx.paymentAllocation.create({ data: { paymentId: p.id, chargeId: a.chargeId, tenantId, amountCentavos: a.amountCentavos } });
      const target = open.find((o) => o.id === a.chargeId)!;
      target.outstandingCentavos -= a.amountCentavos;
      created++;
    }
  }
  return created;
}

/**
 * After a charge's net amount drops (waiver/reduction), release any money
 * allocated beyond the new net — newest allocation first — so it becomes
 * credit again. History is kept: the old allocation is marked reversed and
 * a smaller replacement is written when only part is released.
 */
export async function releaseOverAllocation(tx: Tx, chargeId: string, reason: string): Promise<void> {
  const charge = await tx.charge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { adjustments: { where: { reversedAt: null } }, allocations: { where: { reversedAt: null }, orderBy: { createdAt: "desc" } } },
  });
  const net = charge.amountCentavos + charge.adjustments.reduce((s, a) => s + a.amountCentavos, 0);
  let excess = charge.allocations.reduce((s, a) => s + a.amountCentavos, 0) - Math.max(0, net);
  for (const a of charge.allocations) {
    if (excess <= 0) break;
    await tx.paymentAllocation.update({ where: { id: a.id }, data: { reversedAt: new Date(), reversalReason: reason } });
    const keep = a.amountCentavos - Math.min(excess, a.amountCentavos);
    if (keep > 0) {
      await tx.paymentAllocation.create({ data: { paymentId: a.paymentId, chargeId: a.chargeId, tenantId: a.tenantId, amountCentavos: keep } });
    }
    excess -= a.amountCentavos - keep;
  }
}
