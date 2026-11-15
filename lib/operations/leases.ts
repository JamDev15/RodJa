// Lease terms, renewals and owner-provided lease documents.
//
// A renewal is a new LeaseTerm that starts the day after the previous term
// ends (renewalOfId points back), so the full history of terms is kept.
// Changing the rent at renewal is recorded on the term for reference only:
// the amount actually billed comes from the room's recurring charges, which
// the office updates separately (the renewal screen links there).

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { addDays, fromDbDate, toDbDate, type DateOnly } from "@/lib/collections/calendar";
import { audit, inTransaction, lockKey } from "@/lib/collections/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { tenantFeaturesEnabled } from "./messages";
import { adminTenant, optionalDate, optionalText, ownTenancy, requireDate, today } from "./common";

function optionalCentavos(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0) throw invalid("Rent must be zero or more");
  return n;
}

export async function addLeaseTerm(actor: Actor, tenantId: string, input: { startDate?: unknown; endDate?: unknown; monthlyRentCentavos?: unknown; notes?: unknown }) {
  const tenant = await adminTenant(actor, tenantId);
  const start = requireDate(input.startDate, "Start date");
  const end = optionalDate(input.endDate, "End date");
  if (end && end < start) throw invalid("End date can't be before the start date");
  return inTransaction(async (tx) => {
    await lockKey(tx, `lease:${tenantId}`);
    const terms = await tx.leaseTerm.findMany({ where: { tenantId } });
    if (terms.some((t) => overlaps(fromDbDate(t.startDate), t.endDate ? fromDbDate(t.endDate) : null, start, end))) throw conflict("This term overlaps an existing lease term — use Renew for the next term");
    const term = await tx.leaseTerm.create({
      data: { accountId: tenant.unit.property.accountId, tenantId, startDate: toDbDate(start), endDate: end ? toDbDate(end) : null, monthlyRentCentavos: optionalCentavos(input.monthlyRentCentavos), notes: optionalText(input.notes, 500), createdBy: actor.id },
    });
    await audit(tx, actor, { entityType: "LeaseTerm", entityId: term.id, action: "lease_term_added", propertyId: tenant.unit.propertyId, tenantId, details: { start, end } });
    return term;
  });
}

function overlaps(aStart: DateOnly, aEnd: DateOnly | null, bStart: DateOnly, bEnd: DateOnly | null): boolean {
  return aStart <= (bEnd ?? "9999-12-31") && bStart <= (aEnd ?? "9999-12-31");
}

/** Next term, starting the day after the latest term ends. */
export async function renewLease(actor: Actor, termId: string, input: { endDate?: unknown; monthlyRentCentavos?: unknown; notes?: unknown }) {
  const prev = await prisma.leaseTerm.findFirst({ where: { id: termId, accountId: actor.accountId } });
  if (!prev) throw notFound("Lease term not found");
  const tenant = await adminTenant(actor, prev.tenantId);
  if (!prev.endDate) throw invalid("This term has no end date, so there's nothing to renew");
  const start = addDays(fromDbDate(prev.endDate), 1);
  const end = requireDate(input.endDate, "New end date");
  if (end < start) throw invalid(`The new term starts ${start}; its end date must be on or after that`);
  return inTransaction(async (tx) => {
    await lockKey(tx, `lease:${prev.tenantId}`);
    const later = await tx.leaseTerm.findFirst({ where: { tenantId: prev.tenantId, startDate: { gt: prev.startDate } } });
    if (later) throw conflict("This term has already been renewed");
    const term = await tx.leaseTerm.create({
      data: {
        accountId: prev.accountId,
        tenantId: prev.tenantId,
        startDate: toDbDate(start),
        endDate: toDbDate(end),
        monthlyRentCentavos: optionalCentavos(input.monthlyRentCentavos) ?? prev.monthlyRentCentavos,
        renewalOfId: prev.id,
        notes: optionalText(input.notes, 500),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "LeaseTerm", entityId: term.id, action: "lease_renewed", propertyId: tenant.unit.propertyId, tenantId: prev.tenantId, details: { from: prev.id, start, end } });
    return term;
  });
}

export function currentTerm<T extends { startDate: Date; endDate: Date | null }>(terms: T[], on: DateOnly): T | null {
  const sorted = [...terms].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return sorted.find((t) => fromDbDate(t.startDate) <= on && (!t.endDate || fromDbDate(t.endDate) >= on)) ?? sorted.find((t) => fromDbDate(t.startDate) > on) ?? sorted[0] ?? null;
}

const DOC_KINDS = ["OWNER_LEASE", "SIGNED_COPY", "OTHER"] as const;
export const DOC_LABEL: Record<(typeof DOC_KINDS)[number], string> = { OWNER_LEASE: "Lease (from the owner)", SIGNED_COPY: "Signed copy", OTHER: "Other document" };

/**
 * Upload a lease document. Administrators upload any kind; tenants may only
 * upload a SIGNED_COPY of their own lease (print → sign → upload).
 */
export async function uploadLeaseDocument(actor: Actor, input: { tenantId?: string; kind?: unknown; title?: unknown; leaseTermId?: unknown; file: File | null }) {
  const kind = DOC_KINDS.find((k) => k === input.kind);
  if (!kind) throw invalid("Choose what kind of document this is");
  let tenant;
  if (actor.kind === "TENANT") {
    if (kind !== "SIGNED_COPY") throw forbidden();
    tenant = await ownTenancy(actor);
    if (!(await tenantFeaturesEnabled(tenant.unit.propertyId))) throw forbidden();
  } else {
    tenant = await adminTenant(actor, input.tenantId ?? "");
  }
  const leaseTermId = typeof input.leaseTermId === "string" && input.leaseTermId ? input.leaseTermId : null;
  if (leaseTermId && !(await prisma.leaseTerm.findFirst({ where: { id: leaseTermId, tenantId: tenant.id } }))) throw notFound("Lease term not found");
  const upload = await readUpload(input.file);
  const stored = await storeFile({ actor, accountId: tenant.unit.property.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, purpose: "LEASE_DOCUMENT", file: input.file! }, upload);
  return inTransaction(async (tx) => {
    const doc = await tx.leaseDocument.create({
      data: {
        accountId: tenant.unit.property.accountId,
        tenantId: tenant.id,
        leaseTermId,
        kind,
        title: optionalText(input.title, 120) ?? DOC_LABEL[kind],
        fileId: stored.id,
        uploadedBy: actor.id,
        uploadedByRole: actor.role,
      },
    });
    await audit(tx, actor, { entityType: "LeaseDocument", entityId: doc.id, action: "lease_document_uploaded", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { kind, fileId: stored.id } });
    return doc;
  });
}

export async function leaseView(tenantId: string) {
  const [terms, documents] = await Promise.all([
    prisma.leaseTerm.findMany({ where: { tenantId }, orderBy: { startDate: "asc" } }),
    prisma.leaseDocument.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
  ]);
  return { terms, documents, current: currentTerm(terms, today()) };
}

export async function tenantLeaseView(actor: Actor) {
  const tenant = await ownTenancy(actor);
  return leaseView(tenant.id);
}

/** Terms ending within `days` that haven't been renewed (active tenancies only). */
export async function expiringLeases(accountId: string, propertyId: string | null, days = 60) {
  const from = today();
  const to = addDays(from, days);
  const terms = await prisma.leaseTerm.findMany({
    where: { accountId, endDate: { gte: toDbDate(from), lte: toDbDate(to) }, tenant: { isActive: true, ...(propertyId ? { unit: { propertyId } } : {}) } },
    include: { tenant: { select: { id: true, name: true, unit: { select: { unitNumber: true } } } } },
    orderBy: { endDate: "asc" },
  });
  const renewed = new Set((await prisma.leaseTerm.findMany({ where: { renewalOfId: { in: terms.map((t) => t.id) } }, select: { renewalOfId: true } })).map((r) => r.renewalOfId));
  return terms.filter((t) => !renewed.has(t.id));
}
