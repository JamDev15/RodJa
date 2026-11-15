// Move-in and move-out checklists.
//
// The owner edits templates (per account, optionally per property). Starting
// a checklist for a tenancy copies the template's items, so later template
// edits never rewrite what was recorded for an earlier tenancy.

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminProperty, requireAdmin, type Actor } from "@/lib/collections/actor";
import { audit, inTransaction } from "@/lib/collections/db";
import { conflict, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { adminTenant, optionalText, requireText } from "./common";

export type ChecklistKind = "MOVE_IN" | "MOVE_OUT";

/**
 * Starting points only. Dawson's move-out SOP hasn't been provided yet, so
 * the move-out list is a generic placeholder the owner is expected to edit.
 */
export const DEFAULT_ITEMS: Record<ChecklistKind, { label: string; required: boolean }[]> = {
  MOVE_IN: [
    { label: "Lease signed (or signed copy uploaded)", required: true },
    { label: "Advance rent and security deposit received", required: true },
    { label: "Valid ID on file for every occupant", required: true },
    { label: "Opening water meter reading recorded", required: true },
    { label: "Room condition photos taken", required: false },
    { label: "Keys / access card handed over", required: true },
    { label: "House rules explained", required: false },
    { label: "Tenant portal login shared", required: false },
  ],
  MOVE_OUT: [
    { label: "Move-out notice received", required: true },
    { label: "Room inspected with the tenant", required: true },
    { label: "Final water meter reading recorded", required: true },
    { label: "Latest VECO receipt submitted", required: false },
    { label: "Keys / access card returned", required: true },
    { label: "Damages, if any, charged and explained", required: false },
    { label: "Deposit settled (applied / refunded)", required: true },
  ],
};

const itemsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(200), required: z.boolean().default(false) }))
  .min(1, "Add at least one item")
  .max(60, "At most 60 items");

export function parseKind(v: unknown): ChecklistKind {
  if (v === "MOVE_IN" || v === "MOVE_OUT") return v;
  throw invalid("Checklist type must be move-in or move-out");
}

/** Template text format for the simple editor: one item per line, "*" prefix = required. */
export function parseItemLines(text: unknown) {
  const lines = String(text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("*") ? { label: l.slice(1).trim(), required: true } : { label: l, required: false }));
  const parsed = itemsSchema.safeParse(lines);
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "Invalid checklist items");
  return parsed.data;
}

export function itemsToLines(items: { label: string; required: boolean }[]): string {
  return items.map((i) => `${i.required ? "* " : ""}${i.label}`).join("\n");
}

/** The template that applies to a property: property-specific first, then account-wide. */
export async function effectiveTemplate(accountId: string, propertyId: string, kind: ChecklistKind) {
  const rows = await prisma.checklistTemplate.findMany({ where: { accountId, kind, isActive: true, OR: [{ propertyId }, { propertyId: null }] }, orderBy: { updatedAt: "desc" } });
  return rows.find((r) => r.propertyId === propertyId) ?? rows.find((r) => r.propertyId === null) ?? null;
}

export async function saveTemplate(actor: Actor, input: { propertyId?: unknown; kind?: unknown; name?: unknown; items?: unknown }) {
  requireAdmin(actor);
  const kind = parseKind(input.kind);
  const propertyId = typeof input.propertyId === "string" && input.propertyId ? input.propertyId : null;
  if (propertyId) await adminProperty(actor, propertyId);
  const items = Array.isArray(input.items) ? itemsSchema.parse(input.items) : parseItemLines(input.items);
  const name = optionalText(input.name, 120) ?? (kind === "MOVE_IN" ? "Move-in checklist" : "Move-out checklist");
  return inTransaction(async (tx) => {
    const existing = await tx.checklistTemplate.findFirst({ where: { accountId: actor.accountId, kind, propertyId, isActive: true } });
    const saved = existing
      ? await tx.checklistTemplate.update({ where: { id: existing.id }, data: { name, items: items as unknown as Prisma.InputJsonValue } })
      : await tx.checklistTemplate.create({ data: { accountId: actor.accountId, propertyId, kind, name, items: items as unknown as Prisma.InputJsonValue, createdBy: actor.id } });
    await audit(tx, actor, { entityType: "ChecklistTemplate", entityId: saved.id, action: existing ? "template_updated" : "template_created", propertyId, details: { kind, items: items.length } });
    return saved;
  });
}

/** Start (or return the existing) checklist of a kind for a tenancy. */
export async function startChecklist(actor: Actor, tenantId: string, kindRaw: unknown) {
  const kind = parseKind(kindRaw);
  const tenant = await adminTenant(actor, tenantId);
  const existing = await prisma.tenancyChecklist.findUnique({ where: { tenantId_kind: { tenantId, kind } } });
  if (existing) return existing;
  const tpl = await effectiveTemplate(tenant.unit.property.accountId, tenant.unit.propertyId, kind);
  const items = (tpl?.items as unknown as { label: string; required: boolean }[] | undefined) ?? DEFAULT_ITEMS[kind];
  try {
    return await inTransaction(async (tx) => {
      const cl = await tx.tenancyChecklist.create({
        data: {
          accountId: tenant.unit.property.accountId,
          tenantId,
          kind,
          templateId: tpl?.id ?? null,
          title: tpl?.name ?? (kind === "MOVE_IN" ? "Move-in checklist" : "Move-out checklist"),
          createdBy: actor.id,
          items: { create: items.map((i, position) => ({ position, label: i.label, required: i.required })) },
        },
      });
      await audit(tx, actor, { entityType: "TenancyChecklist", entityId: cl.id, action: "checklist_started", propertyId: tenant.unit.propertyId, tenantId, details: { kind, templateId: tpl?.id ?? null } });
      return cl;
    });
  } catch (err) {
    // Two clicks at once: the unique (tenantId, kind) lets only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return prisma.tenancyChecklist.findUniqueOrThrow({ where: { tenantId_kind: { tenantId, kind } } });
    throw err;
  }
}

async function adminItem(actor: Actor, itemId: string) {
  requireAdmin(actor);
  const item = await prisma.tenancyChecklistItem.findFirst({ where: { id: itemId, checklist: { accountId: actor.accountId } }, include: { checklist: true } });
  if (!item) throw notFound("Checklist item not found");
  const tenant = await adminTenant(actor, item.checklist.tenantId);
  return { item, tenant };
}

export async function setItem(actor: Actor, itemId: string, input: { done?: unknown; note?: unknown }) {
  const { item, tenant } = await adminItem(actor, itemId);
  if (item.checklist.status === "COMPLETED") throw conflict("This checklist is completed. Reopen it to make changes.");
  const done = input.done === true;
  return inTransaction(async (tx) => {
    const saved = await tx.tenancyChecklistItem.update({
      where: { id: item.id },
      data: { done, doneAt: done ? new Date() : null, doneBy: done ? actor.id : null, ...(input.note !== undefined ? { note: optionalText(input.note, 500) } : {}) },
    });
    await audit(tx, actor, { entityType: "TenancyChecklistItem", entityId: item.id, action: done ? "checklist_item_done" : "checklist_item_undone", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { label: item.label } });
    return saved;
  });
}

export async function addItem(actor: Actor, checklistId: string, input: { label?: unknown; required?: unknown }) {
  requireAdmin(actor);
  const cl = await prisma.tenancyChecklist.findFirst({ where: { id: checklistId, accountId: actor.accountId } });
  if (!cl) throw notFound("Checklist not found");
  await adminTenant(actor, cl.tenantId);
  if (cl.status === "COMPLETED") throw conflict("This checklist is completed. Reopen it to make changes.");
  const label = requireText(input.label, "Item", 200);
  const max = await prisma.tenancyChecklistItem.aggregate({ where: { checklistId }, _max: { position: true } });
  return prisma.tenancyChecklistItem.create({ data: { checklistId, label, required: input.required === true, position: (max._max.position ?? -1) + 1 } });
}

export async function attachItemPhoto(actor: Actor, itemId: string, file: File | null) {
  const { item, tenant } = await adminItem(actor, itemId);
  const upload = await readUpload(file);
  const stored = await storeFile({ actor, accountId: item.checklist.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, purpose: "CHECKLIST_PHOTO", file: file! }, upload);
  return prisma.tenancyChecklistItem.update({ where: { id: item.id }, data: { photoFileId: stored.id } });
}

/** Required items still open, if any. */
export function openRequired(items: { label: string; required: boolean; done: boolean }[]): string[] {
  return items.filter((i) => i.required && !i.done).map((i) => i.label);
}

export async function completeChecklist(actor: Actor, checklistId: string) {
  requireAdmin(actor);
  const cl = await prisma.tenancyChecklist.findFirst({ where: { id: checklistId, accountId: actor.accountId }, include: { items: true } });
  if (!cl) throw notFound("Checklist not found");
  const tenant = await adminTenant(actor, cl.tenantId);
  const missing = openRequired(cl.items);
  if (missing.length) throw invalid(`Finish the required items first: ${missing.join("; ")}`);
  return inTransaction(async (tx) => {
    const claimed = await tx.tenancyChecklist.updateMany({ where: { id: cl.id, status: "OPEN" }, data: { status: "COMPLETED", completedAt: new Date(), completedBy: actor.id } });
    if (claimed.count) await audit(tx, actor, { entityType: "TenancyChecklist", entityId: cl.id, action: "checklist_completed", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { kind: cl.kind } });
    return tx.tenancyChecklist.findUniqueOrThrow({ where: { id: cl.id } });
  });
}

export async function reopenChecklist(actor: Actor, checklistId: string, reason: unknown) {
  requireAdmin(actor);
  const cl = await prisma.tenancyChecklist.findFirst({ where: { id: checklistId, accountId: actor.accountId } });
  if (!cl) throw notFound("Checklist not found");
  const tenant = await adminTenant(actor, cl.tenantId);
  const why = requireText(reason, "Reason", 300);
  return inTransaction(async (tx) => {
    const saved = await tx.tenancyChecklist.update({ where: { id: cl.id }, data: { status: "OPEN", completedAt: null, completedBy: null } });
    await audit(tx, actor, { entityType: "TenancyChecklist", entityId: cl.id, action: "checklist_reopened", propertyId: tenant.unit.propertyId, tenantId: tenant.id, details: { reason: why } });
    return saved;
  });
}

export async function checklistsFor(tenantId: string) {
  return prisma.tenancyChecklist.findMany({ where: { tenantId }, include: { items: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } });
}
