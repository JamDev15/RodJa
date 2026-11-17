// Household records: everyone living in the room under one tenancy,
// including the tenant of record. At most MAX_OCCUPANTS at a time.
//
// The billing occupant count (Tenant.occupantCount, which drives the water
// charge) is deliberately NOT changed automatically: the office sees a
// mismatch warning and decides, so editing the household never silently
// changes a bill.

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { toDbDate, fromDbDate } from "@/lib/collections/calendar";
import { audit, inTransaction, lockKey } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { adminTenant, optionalDate, optionalText, ownTenancy, requireDate, requireText, toDateOnly } from "./common";

export const MAX_OCCUPANTS = 4;

export interface OccupantInput {
  name?: unknown;
  relationship?: unknown;
  phone?: unknown;
  isPrimary?: unknown;
  movedInOn?: unknown;
  notes?: unknown;
}

export async function addOccupant(actor: Actor, tenantId: string, raw: OccupantInput) {
  const tenant = await adminTenant(actor, tenantId);
  const name = requireText(raw.name, "Name", 120);
  const movedInOn = optionalDate(raw.movedInOn, "Move-in date") ?? toDateOnly(tenant.moveInDate);
  const phone = optionalText(raw.phone, 40);
  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) throw invalid("Phone number looks invalid");
  return inTransaction(async (tx) => {
    // Serialize household changes per tenancy so two adds can't both pass the limit.
    await lockKey(tx, `household:${tenant.id}`);
    const active = await tx.occupant.count({ where: { tenantId: tenant.id, movedOutOn: null } });
    if (active >= MAX_OCCUPANTS) throw conflict(`A room can have at most ${MAX_OCCUPANTS} occupants. Mark someone as moved out first.`);
    const isPrimary = raw.isPrimary === true;
    if (isPrimary && (await tx.occupant.count({ where: { tenantId: tenant.id, isPrimary: true, movedOutOn: null } })) > 0) throw conflict("The tenant of record is already listed");
    const occ = await tx.occupant.create({
      data: {
        accountId: tenant.unit.property.accountId,
        tenantId: tenant.id,
        name,
        isPrimary,
        relationship: optionalText(raw.relationship, 60),
        phone,
        movedInOn: toDbDate(movedInOn),
        notes: optionalText(raw.notes, 500),
        createdBy: actor.id,
      },
    });
    await audit(tx, actor, { entityType: "Occupant", entityId: occ.id, action: "occupant_added", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { name, isPrimary } });
    return occ;
  });
}

async function adminOccupant(actor: Actor, occupantId: string) {
  const occ = await prisma.occupant.findFirst({ where: { id: occupantId, accountId: actor.accountId } });
  if (!occ) throw notFound("Occupant not found");
  const tenant = await adminTenant(actor, occ.tenantId);
  return { occ, tenant };
}

export async function updateOccupant(actor: Actor, occupantId: string, raw: Partial<OccupantInput>) {
  const { occ, tenant } = await adminOccupant(actor, occupantId);
  const data: Record<string, unknown> = {};
  if (raw.name !== undefined) data.name = requireText(raw.name, "Name", 120);
  if (raw.relationship !== undefined) data.relationship = optionalText(raw.relationship, 60);
  if (raw.phone !== undefined) data.phone = optionalText(raw.phone, 40);
  if (raw.notes !== undefined) data.notes = optionalText(raw.notes, 500);
  return inTransaction(async (tx) => {
    const saved = await tx.occupant.update({ where: { id: occ.id }, data });
    await audit(tx, actor, { entityType: "Occupant", entityId: occ.id, action: "occupant_updated", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: data });
    return saved;
  });
}

/** Record that someone left the room. The record (and any ID) is kept for history. */
export async function moveOutOccupant(actor: Actor, occupantId: string, movedOutOnRaw: unknown) {
  const { occ, tenant } = await adminOccupant(actor, occupantId);
  const movedOutOn = requireDate(movedOutOnRaw, "Moved-out date");
  if (occ.movedOutOn) throw conflict("Already marked as moved out");
  if (movedOutOn < fromDbDate(occ.movedInOn)) throw invalid("Moved-out date can't be before the move-in date");
  return inTransaction(async (tx) => {
    const saved = await tx.occupant.update({ where: { id: occ.id }, data: { movedOutOn: toDbDate(movedOutOn) } });
    await audit(tx, actor, { entityType: "Occupant", entityId: occ.id, action: "occupant_moved_out", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { movedOutOn } });
    return saved;
  });
}

/** Attach an ID document or photo. Stored privately; only administrators can open it. */
export async function attachOccupantFile(actor: Actor, occupantId: string, which: "id" | "photo", file: File | null) {
  const { occ, tenant } = await adminOccupant(actor, occupantId);
  const upload = await readUpload(file);
  if (which === "photo" && upload.kind.mime === "application/pdf") throw invalid("Upload the photo as an image");
  const stored = await storeFile(
    { actor, accountId: occ.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, purpose: which === "id" ? "OCCUPANT_ID" : "OCCUPANT_PHOTO", file: file! },
    upload,
  );
  return inTransaction(async (tx) => {
    const saved = await tx.occupant.update({ where: { id: occ.id }, data: which === "id" ? { idFileId: stored.id } : { photoFileId: stored.id } });
    await audit(tx, actor, { entityType: "Occupant", entityId: occ.id, action: which === "id" ? "occupant_id_uploaded" : "occupant_photo_uploaded", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { fileId: stored.id } });
    return saved;
  });
}

export async function householdAdminView(actor: Actor, tenantId: string) {
  const tenant = await adminTenant(actor, tenantId);
  const occupants = await prisma.occupant.findMany({ where: { tenantId }, orderBy: [{ movedOutOn: { sort: "asc", nulls: "first" } }, { isPrimary: "desc" }, { createdAt: "asc" }] });
  const active = occupants.filter((o) => !o.movedOutOn);
  return {
    occupants,
    activeCount: active.length,
    billingCount: tenant.occupantCount,
    mismatch: active.length > 0 && tenant.occupantCount != null && tenant.occupantCount !== active.length,
    missingCount: active.length > 0 && tenant.occupantCount == null,
  };
}

/** Tenants see names and relationships of their household — never IDs, photos or notes. */
export async function householdTenantView(actor: Actor) {
  const tenant = await ownTenancy(actor);
  const occupants = await prisma.occupant.findMany({
    where: { tenantId: tenant.id, movedOutOn: null },
    select: { id: true, name: true, relationship: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  return occupants;
}
