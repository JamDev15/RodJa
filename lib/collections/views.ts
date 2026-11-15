// Read models for the admin dashboard, statement pages and the tenant
// portal. Every balance comes from loadTenantLedger — the same calculation
// for every screen.
//
// Dashboard definitions (shown on screen next to each figure):
//  - Charges issued: posted charges whose billing month/period is selected,
//    gross, plus waivers/reductions made to them.
//  - Payments received: APPROVED payments whose paid-on date is in the month.
//  - Outstanding: everything still unpaid on posted charges as of today.
//  - Overdue: the part of outstanding whose due date has passed.

import { prisma } from "@/lib/prisma";
import { adminProperty, requireAdmin, requireTenant, type Actor } from "./actor";
import { addMonths, fromDbDate, isValidMonth, monthOf, parsePeriodKey, todayIn } from "./calendar";
import { notFound } from "./errors";
import { loadTenantLedger } from "./ledger";
import { getProfile } from "./profile";
import { settlementStatus } from "./statement-math";
import { missingVecoReceipts } from "./veco";

export interface OverviewFilters {
  month?: string; // "YYYY-MM"
  periodKey?: string; // "YYYY-MM-A"
  unitId?: string;
  tenantId?: string;
  paymentStatus?: string;
}

export async function collectionsOverview(actor: Actor, propertyId: string, filters: OverviewFilters, now?: Date) {
  const property = await adminProperty(actor, propertyId);
  const profile = await getProfile(propertyId);
  const tz = profile?.timezone ?? "Asia/Manila";
  const today = todayIn(tz, now);
  const period = filters.periodKey && parsePeriodKey(filters.periodKey) ? filters.periodKey : null;
  const month = period ? period.slice(0, 7) : filters.month && isValidMonth(filters.month) ? filters.month : monthOf(today);

  const tenantWhere = {
    unit: { propertyId },
    ...(filters.unitId ? { unitId: filters.unitId } : {}),
    ...(filters.tenantId ? { id: filters.tenantId } : {}),
  };
  const tenants = await prisma.tenant.findMany({
    where: { ...tenantWhere, OR: [{ isActive: true }, { charges: { some: {} } }] },
    include: { unit: true },
    orderBy: [{ unit: { unitNumber: "asc" } }, { moveInDate: "asc" }],
  });
  const tenantIds = tenants.map((t) => t.id);

  const issued = await prisma.charge.findMany({
    where: { propertyId, tenantId: { in: tenantIds }, status: "POSTED", ...(period ? { periodKey: period } : { billingMonth: month }) },
    include: { adjustments: { where: { reversedAt: null } } },
  });
  const chargesIssuedCentavos = issued.reduce((s, c) => s + c.amountCentavos, 0);
  const adjustmentsCentavos = issued.reduce((s, c) => s + c.adjustments.reduce((a, x) => a + x.amountCentavos, 0), 0);

  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonthStart = new Date(`${addMonths(month, 1)}-01T00:00:00Z`);
  const received = await prisma.rentPayment.aggregate({
    where: { propertyId, tenantId: { in: tenantIds }, status: "APPROVED", paidOn: { gte: monthStart, lt: nextMonthStart } },
    _sum: { amountCentavos: true },
    _count: true,
  });

  const rows = [];
  let outstanding = 0;
  let overdue = 0;
  let credit = 0;
  for (const t of tenants) {
    const ledger = await loadTenantLedger(prisma, t.id, today);
    outstanding += ledger.outstandingCentavos;
    overdue += ledger.overdueCentavos;
    credit += ledger.creditCentavos;
    const latest = await prisma.statement.findFirst({ where: { tenantId: t.id, status: "PUBLISHED" }, orderBy: { cycleDate: "desc" } });
    const latestLines = latest ? ledger.charges.filter((c) => c.statementId === latest.id) : [];
    rows.push({
      tenantId: t.id,
      tenantName: t.name,
      isActive: t.isActive,
      unitId: t.unitId,
      unitNumber: t.unit.unitNumber,
      occupantCount: t.occupantCount,
      outstandingCentavos: ledger.outstandingCentavos,
      overdueCentavos: ledger.overdueCentavos,
      creditCentavos: ledger.creditCentavos,
      latestStatement: latest
        ? { id: latest.id, number: latest.number, periodKey: latest.periodKey, dueDate: fromDbDate(latest.dueDate), status: settlementStatus(latestLines, fromDbDate(latest.dueDate), today) }
        : null,
    });
  }

  const paymentStatus = filters.paymentStatus && ["PENDING", "APPROVED", "REJECTED", "REVERSED"].includes(filters.paymentStatus) ? filters.paymentStatus : undefined;
  const payments = await prisma.rentPayment.findMany({
    where: { propertyId, tenantId: { in: tenantIds }, ...(paymentStatus ? { status: paymentStatus } : { status: "PENDING" }) },
    include: { tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const pendingApprovals = await prisma.rentPayment.count({ where: { propertyId, status: "PENDING" } });
  const pendingVeco = await prisma.vecoReceipt.count({ where: { propertyId, status: "PENDING" } });
  const missingVeco = (await missingVecoReceipts(propertyId, today)).filter((m) => tenantIds.includes(m.tenantId));
  const waterAlerts = await prisma.meterReading.findMany({
    where: { propertyId, status: "ACTIVE", overAllowance: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    include: { unit: { select: { unitNumber: true } }, excessProposal: true },
    orderBy: { readingDate: "desc" },
    take: 20,
  });
  const drafts = await prisma.statement.count({ where: { propertyId, status: "DRAFT" } });

  return {
    property: { id: property.id, name: property.name },
    profile,
    today,
    month,
    periodKey: period,
    totals: {
      chargesIssuedCentavos,
      adjustmentsCentavos,
      paymentsReceivedCentavos: received._sum.amountCentavos ?? 0,
      paymentsReceivedCount: received._count,
      outstandingCentavos: outstanding,
      overdueCentavos: overdue,
      creditCentavos: credit,
      overdueAccounts: rows.filter((r) => r.overdueCentavos > 0).length,
      pendingApprovals,
      pendingVeco,
      missingVecoTenants: missingVeco.length,
      waterAlerts: waterAlerts.filter((w) => !w.excessProposal || w.excessProposal.status === "PENDING").length,
      drafts,
    },
    rows,
    payments: payments.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      tenantName: p.tenant.name,
      unitNumber: p.tenant.unit.unitNumber,
      amountCentavos: p.amountCentavos,
      method: p.method,
      referenceNumber: p.referenceNumber,
      paidOn: fromDbDate(p.paidOn),
      status: p.status,
      proofFileId: p.proofFileId,
      rejectedReason: p.rejectedReason,
      createdAt: p.createdAt.toISOString(),
    })),
    missingVeco,
    waterAlerts: waterAlerts.map((w) => ({
      readingId: w.id,
      unitNumber: w.unit.unitNumber,
      readingDate: fromDbDate(w.readingDate),
      usage: w.usage?.toString() ?? null,
      proposal: w.excessProposal ? { id: w.excessProposal.id, status: w.excessProposal.status, proposedCentavos: w.excessProposal.proposedCentavos, excessUnits: w.excessProposal.excessUnits.toString() } : null,
    })),
  };
}

/** Live view of one statement: what was issued, plus anything that changed since. */
export async function statementDetail(actor: Actor, statementId: string, now?: Date) {
  if (!actor || (actor.kind !== "ADMIN" && actor.kind !== "TENANT")) throw notFound("Statement not found");
  const st = await prisma.statement.findFirst({
    where: { id: statementId, accountId: actor.accountId, ...(actor.kind === "TENANT" ? { tenantId: actor.tenantId, status: "PUBLISHED" } : {}) },
    include: { tenant: { include: { unit: { include: { property: true } } } } },
  });
  if (!st) throw notFound("Statement not found");
  const profile = await getProfile(st.propertyId);
  const today = todayIn(profile?.timezone ?? "Asia/Manila", now);
  const charges = await prisma.charge.findMany({
    where: { statementId: st.id },
    include: {
      adjustments: { orderBy: { createdAt: "asc" } },
      allocations: { orderBy: { createdAt: "asc" }, include: { payment: { select: { id: true, receiptNumber: true, paidOn: true, method: true, status: true } } } },
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  const ledger = await loadTenantLedger(prisma, st.tenantId, today);
  const lines = charges.map((c) => {
    const live = ledger.charges.find((l) => l.id === c.id);
    return {
      id: c.id,
      type: c.type,
      description: c.description,
      amountCentavos: c.amountCentavos,
      status: c.status,
      calc: c.calc,
      netCentavos: live?.netCentavos ?? c.amountCentavos,
      outstandingCentavos: live?.outstandingCentavos ?? (c.status === "POSTED" ? 0 : c.amountCentavos),
      adjustments: c.adjustments.map((a) => ({ id: a.id, kind: a.kind, amountCentavos: a.amountCentavos, reason: a.reason, createdAt: a.createdAt.toISOString(), reversedAt: a.reversedAt?.toISOString() ?? null })),
      allocations: c.allocations.map((a) => ({
        id: a.id,
        amountCentavos: a.amountCentavos,
        createdAt: a.createdAt.toISOString(),
        reversedAt: a.reversedAt?.toISOString() ?? null,
        receiptNumber: a.payment.receiptNumber,
        paidOn: fromDbDate(a.payment.paidOn),
        method: a.payment.method,
      })),
    };
  });
  const posted = ledger.charges.filter((c) => c.statementId === st.id);
  const changesSinceIssue = st.publishedAt
    ? [
        ...lines.flatMap((l) => l.adjustments.filter((a) => new Date(a.createdAt) > st.publishedAt!).map((a) => ({ at: a.createdAt, text: `${l.description}: ${a.kind === "WAIVER" ? "waived" : "reduced"} (${a.reason})`, amountCentavos: a.amountCentavos, reversed: !!a.reversedAt }))),
        ...lines.flatMap((l) => l.allocations.filter((a) => new Date(a.createdAt) > st.publishedAt!).map((a) => ({ at: a.createdAt, text: `${l.description}: payment ${a.receiptNumber ?? ""} applied`.trim(), amountCentavos: -a.amountCentavos, reversed: !!a.reversedAt }))),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];
  return {
    statement: {
      id: st.id,
      number: st.number,
      status: st.status,
      periodKey: st.periodKey,
      cycleDate: fromDbDate(st.cycleDate),
      periodStart: fromDbDate(st.periodStart),
      periodEnd: fromDbDate(st.periodEnd),
      distributeOn: fromDbDate(st.distributeOn),
      dueDate: fromDbDate(st.dueDate),
      publishedAt: st.publishedAt?.toISOString() ?? null,
      sentAt: st.sentAt?.toISOString() ?? null,
      snapshot: st.snapshot as Record<string, unknown> | null,
      settlement: st.status === "PUBLISHED" ? settlementStatus(posted, fromDbDate(st.dueDate), today) : null,
      outstandingNowCentavos: posted.reduce((s, c) => s + c.outstandingCentavos, 0),
    },
    tenant: { id: st.tenant.id, name: st.tenant.name, email: st.tenant.email },
    unit: { id: st.unitId, unitNumber: st.tenant.unit.unitNumber },
    property: { id: st.propertyId, name: st.tenant.unit.property.name, address: st.tenant.unit.property.address },
    profile: profile ? { paymentInstructions: profile.paymentInstructions, logoFileId: profile.logoFileId } : null,
    lines,
    changesSinceIssue,
    ledgerNow: { outstandingCentavos: ledger.outstandingCentavos, creditCentavos: ledger.creditCentavos, netBalanceCentavos: ledger.netBalanceCentavos },
    today,
  };
}

/** Everything the tenant portal shows — the tenant's own tenancy only. */
export async function tenantBillingView(actor: Actor, now?: Date) {
  requireTenant(actor);
  const tenant = await prisma.tenant.findFirst({ where: { id: actor.tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: { include: { property: true, roomBilling: true } } } });
  if (!tenant) throw notFound("Tenant not found");
  const profile = await getProfile(tenant.unit.propertyId);
  if (!profile?.enabled) return { enabled: false as const };
  const today = todayIn(profile.timezone, now);
  const ledger = await loadTenantLedger(prisma, tenant.id, today);
  const [statements, payments, veco, missing, account] = await Promise.all([
    prisma.statement.findMany({ where: { tenantId: tenant.id, status: "PUBLISHED" }, orderBy: { cycleDate: "desc" }, take: 36 }),
    prisma.rentPayment.findMany({
      where: { tenantId: tenant.id },
      include: { allocations: { where: { reversedAt: null }, include: { charge: { select: { description: true, billingMonth: true, periodKey: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    profile.vecoEnabled ? prisma.vecoReceipt.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 24 }) : Promise.resolve([]),
    profile.vecoEnabled ? missingVecoReceipts(tenant.unit.propertyId, today).then((m) => m.find((x) => x.tenantId === tenant.id)?.months ?? []) : Promise.resolve([]),
    prisma.account.findUnique({ where: { id: actor.accountId }, select: { gcashNumber: true, mayaNumber: true, bankDetails: true } }),
  ]);
  return {
    enabled: true as const,
    today,
    tenant: { name: tenant.name, unitNumber: tenant.unit.unitNumber, propertyName: tenant.unit.property.name },
    vecoEnabled: profile.vecoEnabled,
    vecoAccountNumber: tenant.unit.roomBilling?.vecoAccountNumber ?? null,
    paymentInstructions: profile.paymentInstructions,
    account,
    balance: { outstandingCentavos: ledger.outstandingCentavos, overdueCentavos: ledger.overdueCentavos, creditCentavos: ledger.creditCentavos, netBalanceCentavos: ledger.netBalanceCentavos },
    statements: statements.map((s) => {
      const lines = ledger.charges.filter((c) => c.statementId === s.id);
      return {
        id: s.id,
        number: s.number,
        periodKey: s.periodKey,
        cycleDate: fromDbDate(s.cycleDate),
        dueDate: fromDbDate(s.dueDate),
        totalDueCentavos: s.totalDueCentavos,
        status: settlementStatus(lines, fromDbDate(s.dueDate), today),
      };
    }),
    payments: payments.map((p) => ({
      id: p.id,
      amountCentavos: p.amountCentavos,
      method: p.method,
      referenceNumber: p.referenceNumber,
      paidOn: fromDbDate(p.paidOn),
      status: p.status,
      rejectedReason: p.rejectedReason,
      reversalReason: p.reversalReason,
      receiptNumber: p.receiptNumber,
      proofFileId: p.proofFileId,
      createdAt: p.createdAt.toISOString(),
      allocatedCentavos: p.allocations.reduce((s, a) => s + a.amountCentavos, 0),
      allocations: p.allocations.map((a) => ({ description: a.charge.description, periodKey: a.charge.periodKey, amountCentavos: a.amountCentavos })),
    })),
    veco: veco.map((v) => ({ id: v.id, billingMonth: v.billingMonth, status: v.status, rejectedReason: v.rejectedReason, fileId: v.fileId, amountCentavos: v.amountCentavos, createdAt: v.createdAt.toISOString() })),
    missingVecoMonths: missing,
  };
}

/** Admin: one tenant's full collections ledger. */
export async function tenantLedgerAdminView(actor: Actor, tenantId: string, now?: Date) {
  requireAdmin(actor);
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: { include: { property: true, roomBilling: true, recurringCharges: { orderBy: { createdAt: "asc" } } } } } });
  if (!tenant) throw notFound("Tenant not found");
  const profile = await getProfile(tenant.unit.propertyId);
  const today = todayIn(profile?.timezone ?? "Asia/Manila", now);
  const [ledger, statements, payments, audits] = await Promise.all([
    loadTenantLedger(prisma, tenantId, today),
    prisma.statement.findMany({ where: { tenantId }, orderBy: { cycleDate: "desc" }, take: 48 }),
    prisma.rentPayment.findMany({ where: { tenantId }, include: { allocations: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.billingAuditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const adjustments = await prisma.chargeAdjustment.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  return { tenant, profile, today, ledger, statements, payments, adjustments, audits };
}
