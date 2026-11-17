// VECO electricity receipts. Tenants pay VECO directly; we only keep proof
// that they did. Nothing here touches charges, payments, or rental income.

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireTenant, type Actor } from "./actor";
import { addMonths, dateIn, isValidDate, isValidMonth, monthOf, toDbDate, todayIn, type MonthKey } from "./calendar";
import { audit, inTransaction } from "./db";
import { conflict, invalid, notFound } from "./errors";
import { readUpload, storeFile } from "./files";
import { getProfile } from "./profile";
import { parsePesos } from "./money";

/**
 * Electricity months a tenancy should have a receipt for by `today`: from the
 * later of move-in and when VECO tracking started, through the last month
 * whose receipt due day (in the following month) has passed.
 */
export function expectedVecoMonths(opts: { moveIn: string; moveOut: string | null; trackingStart: MonthKey; dueDay: number; today: string }): MonthKey[] {
  const months: MonthKey[] = [];
  let m = monthOf(opts.moveIn) > opts.trackingStart ? monthOf(opts.moveIn) : opts.trackingStart;
  const lastByDue = (() => {
    // month M is due on day `dueDay` of M+1
    const thisMonth = monthOf(opts.today);
    const dayOfMonth = Number(opts.today.slice(8, 10));
    return dayOfMonth > opts.dueDay ? addMonths(thisMonth, -1) : addMonths(thisMonth, -2);
  })();
  const last = opts.moveOut && monthOf(opts.moveOut) < lastByDue ? monthOf(opts.moveOut) : lastByDue;
  while (m <= last && months.length < 24) {
    months.push(m);
    m = addMonths(m, 1);
  }
  return months;
}

export async function missingVecoReceipts(propertyId: string, today?: string) {
  const profile = await getProfile(propertyId);
  if (!profile?.enabled || !profile.vecoEnabled) return [];
  const day = today ?? todayIn(profile.timezone);
  const trackingStart = monthOf(dateIn(profile.timezone, profile.createdAt));
  const tenants = await prisma.tenant.findMany({
    where: { unit: { propertyId }, OR: [{ isActive: true }, { moveOutDate: { not: null } }] },
    include: { unit: { include: { roomBilling: true } }, vecoReceipts: { where: { status: { in: ["PENDING", "VERIFIED"] } }, select: { billingMonth: true } } },
  });
  const out: { tenantId: string; tenantName: string; email: string | null; unitId: string; unitNumber: string; vecoAccountNumber: string | null; months: MonthKey[] }[] = [];
  for (const t of tenants) {
    const have = new Set(t.vecoReceipts.map((r) => r.billingMonth));
    const expected = expectedVecoMonths({
      moveIn: dateIn(profile.timezone, t.moveInDate),
      moveOut: t.moveOutDate ? dateIn(profile.timezone, t.moveOutDate) : null,
      trackingStart,
      dueDay: profile.vecoReceiptDueDay,
      today: day,
    });
    const months = expected.filter((m) => !have.has(m));
    if (months.length) out.push({ tenantId: t.id, tenantName: t.name, email: t.email, unitId: t.unitId, unitNumber: t.unit.unitNumber, vecoAccountNumber: t.unit.roomBilling?.vecoAccountNumber ?? null, months });
  }
  return out;
}

export async function submitVecoReceipt(actor: Actor, input: { billingMonth: string; amount?: string | null; paidOn?: string | null }, file: File | null) {
  requireTenant(actor);
  if (!isValidMonth(input.billingMonth)) throw invalid("Choose the electricity billing month");
  const tenant = await prisma.tenant.findFirst({ where: { id: actor.tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: { include: { roomBilling: true } } } });
  if (!tenant) throw notFound("Tenant not found");
  const profile = await getProfile(tenant.unit.propertyId);
  if (!profile?.enabled || !profile.vecoEnabled) throw invalid("VECO receipt tracking isn't turned on for this property");
  const today = todayIn(profile.timezone);
  if (input.billingMonth > monthOf(today)) throw invalid("That billing month hasn't happened yet");
  if (input.paidOn && (!isValidDate(input.paidOn) || input.paidOn > today)) throw invalid("Invalid payment date");
  const amountCentavos = input.amount ? parsePesos(input.amount) : null;
  if (input.amount && amountCentavos == null) throw invalid("Invalid amount");
  const upload = await readUpload(file);
  const existing = await prisma.vecoReceipt.findFirst({ where: { tenantId: tenant.id, billingMonth: input.billingMonth, status: { in: ["PENDING", "VERIFIED"] } } });
  if (existing) throw conflict("You've already uploaded a receipt for that month");
  const stored = await storeFile({ actor, accountId: actor.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, purpose: "VECO_RECEIPT", file: file! }, upload);
  return inTransaction(async (tx) => {
    const r = await tx.vecoReceipt.create({
      data: {
        accountId: actor.accountId,
        propertyId: tenant.unit.propertyId,
        unitId: tenant.unitId,
        tenantId: tenant.id,
        billingMonth: input.billingMonth,
        vecoAccountNumber: tenant.unit.roomBilling?.vecoAccountNumber ?? null,
        amountCentavos,
        paidOn: input.paidOn ? toDbDate(input.paidOn) : null,
        fileId: stored.id,
        submittedBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "VecoReceipt", entityId: r.id, action: "veco_submitted", propertyId: r.propertyId, tenantId: r.tenantId, details: { billingMonth: r.billingMonth } });
    return r;
  });
}

export async function reviewVecoReceipt(actor: Actor, receiptId: string, decision: "VERIFY" | "REJECT", reason?: string) {
  requireAdmin(actor);
  const r = await prisma.vecoReceipt.findFirst({ where: { id: receiptId, accountId: actor.accountId } });
  if (!r) throw notFound("Receipt not found");
  if (decision === "REJECT" && !reason?.trim()) throw invalid("Give the tenant a reason");
  return inTransaction(async (tx) => {
    const claimed = await tx.vecoReceipt.updateMany({
      where: { id: r.id, status: "PENDING" },
      data: { status: decision === "VERIFY" ? "VERIFIED" : "REJECTED", rejectedReason: decision === "REJECT" ? reason!.trim().slice(0, 500) : null, reviewedBy: actor.id, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw conflict("This receipt was already reviewed");
    await audit(tx, actor, { entityType: "VecoReceipt", entityId: r.id, action: decision === "VERIFY" ? "veco_verified" : "veco_rejected", propertyId: r.propertyId, tenantId: r.tenantId, details: { reason: reason ?? null } });
  });
}
