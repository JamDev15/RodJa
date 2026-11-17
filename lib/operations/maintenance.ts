// Maintenance requests and caretaker work orders.
//
// Statuses: SUBMITTED → ASSIGNED → IN_PROGRESS ⇄ WAITING → COMPLETED → CLOSED.
// Requests created before this feature use open / in_progress / resolved;
// normalizeStatus reads both, and old rows are only rewritten when someone
// changes their status.
//
// Who can do what:
//  - Tenant: create a request for their room, add notes and photos to their
//    own requests, see updates marked visible to them.
//  - Caretaker: see and work on requests assigned to them at their assigned
//    properties: start, wait, complete, notes and photos. Never sees tenant
//    contact details or anything financial.
//  - Administrator: everything, including assignment and closing.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { caretakerPropertyIds, requireAdmin, type Actor } from "@/lib/collections/actor";
import { audit, inTransaction } from "@/lib/collections/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/collections/errors";
import { readUpload, storeFile } from "@/lib/collections/files";
import { actorName, optionalText, ownTenancy, requireText } from "./common";

import { allowedMoves, normalizeStatus, OPEN, OPEN_RAW, PRIORITIES, rawStatuses, STATUS_LABEL, STATUSES, type MaintenanceStatus } from "./maintenance-status";
export { allowedMoves, normalizeStatus, OPEN_RAW, PRIORITIES, rawStatuses, STATUS_LABEL, STATUSES, type MaintenanceStatus };

/** Request scope for an account, covering rows created before accountId existed. */
export function accountScope(accountId: string): Prisma.MaintenanceRequestWhereInput {
  return { OR: [{ accountId }, { accountId: null, tenant: { unit: { property: { accountId } } } }] };
}

/** Property scope, covering old rows that only link through the tenant. */
export function propertyScope(propertyId: string): Prisma.MaintenanceRequestWhereInput {
  return { OR: [{ propertyId }, { propertyId: null, tenant: { unit: { propertyId } } }] };
}

async function loadForActor(actor: Actor, requestId: string) {
  const req = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, ...accountScope(actor.accountId) },
    include: { tenant: { include: { unit: true } } },
  });
  if (!req) throw notFound("Request not found");
  const propertyId = req.propertyId ?? req.tenant?.unit.propertyId ?? null;
  if (actor.kind === "ADMIN" || actor.kind === "SYSTEM") return { req, propertyId };
  if (actor.kind === "TENANT") {
    if (req.tenantId !== actor.tenantId) throw notFound("Request not found");
    return { req, propertyId };
  }
  if (actor.kind === "CARETAKER") {
    const ids = await caretakerPropertyIds(actor);
    if (req.assignedToId !== actor.id || !propertyId || !ids.includes(propertyId)) throw notFound("Request not found");
    return { req, propertyId };
  }
  throw forbidden();
}

function parsePriority(v: unknown): (typeof PRIORITIES)[number] {
  return (PRIORITIES as readonly unknown[]).includes(v) ? (v as (typeof PRIORITIES)[number]) : "normal";
}

/** Tenant: report a problem in their room. */
export async function createTenantRequest(actor: Actor, input: { title?: unknown; description?: unknown; priority?: unknown; category?: unknown }) {
  const tenant = await ownTenancy(actor);
  return prisma.maintenanceRequest.create({
    data: {
      tenantId: tenant.id,
      accountId: tenant.unit.property.accountId,
      propertyId: tenant.unit.propertyId,
      unitId: tenant.unitId,
      title: requireText(input.title, "Title", 120),
      description: requireText(input.description, "Description", 4000),
      priority: parsePriority(input.priority),
      category: optionalText(input.category, 60),
      status: "SUBMITTED",
      source: "TENANT",
    },
  });
}

/** Administrator: log a request for a room (on a tenant's behalf) or a common area. */
export async function createAdminRequest(actor: Actor, input: { propertyId?: unknown; unitId?: unknown; title?: unknown; description?: unknown; priority?: unknown; category?: unknown; assignedToId?: unknown }) {
  requireAdmin(actor);
  const property = await prisma.property.findFirst({ where: { id: String(input.propertyId ?? ""), accountId: actor.accountId } });
  if (!property) throw notFound("Property not found");
  let unitId: string | null = null;
  let tenantId: string | null = null;
  if (typeof input.unitId === "string" && input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, propertyId: property.id }, include: { tenants: { where: { isActive: true }, orderBy: { moveInDate: "desc" }, take: 1 } } });
    if (!unit) throw notFound("Room not found");
    unitId = unit.id;
    tenantId = unit.tenants[0]?.id ?? null;
  }
  const assignee = await validAssignee(actor.accountId, property.id, input.assignedToId);
  return inTransaction(async (tx) => {
    const req = await tx.maintenanceRequest.create({
      data: {
        accountId: actor.accountId,
        propertyId: property.id,
        unitId,
        tenantId,
        title: requireText(input.title, "Title", 120),
        description: requireText(input.description, "Description", 4000),
        priority: parsePriority(input.priority),
        category: optionalText(input.category, 60),
        status: assignee ? "ASSIGNED" : "SUBMITTED",
        source: "ADMIN",
        assignedToId: assignee?.id ?? null,
      },
    });
    await tx.maintenanceUpdate.create({ data: { requestId: req.id, actorId: actor.id, actorRole: actor.role, actorName: await actorName(actor), statusTo: req.status, assignedToId: assignee?.id ?? null, note: "Request logged by the office" } });
    await audit(tx, actor, { entityType: "MaintenanceRequest", entityId: req.id, action: "maintenance_created", propertyId: property.id, tenantId, details: { assignedToId: assignee?.id ?? null } });
    return req;
  });
}

async function validAssignee(accountId: string, propertyId: string, raw: unknown) {
  if (raw == null || raw === "") return null;
  const user = await prisma.user.findFirst({ where: { id: String(raw), accountId } });
  if (!user) throw notFound("Staff member not found");
  if (user.role === "CARETAKER") {
    const assigned = await prisma.caretakerProperty.findFirst({ where: { userId: user.id, propertyId } });
    if (!assigned) throw invalid(`${user.name} isn't assigned to this property`);
  }
  return user;
}

/** Administrator: assign (or unassign) a caretaker / staff member. */
export async function assignRequest(actor: Actor, requestId: string, assignedToId: unknown) {
  requireAdmin(actor);
  const { req, propertyId } = await loadForActor(actor, requestId);
  if (!propertyId) throw invalid("This request isn't linked to a property");
  const assignee = await validAssignee(actor.accountId, propertyId, assignedToId);
  const from = normalizeStatus(req.status);
  const to: MaintenanceStatus = assignee && from === "SUBMITTED" ? "ASSIGNED" : !assignee && from === "ASSIGNED" ? "SUBMITTED" : from;
  return inTransaction(async (tx) => {
    const saved = await tx.maintenanceRequest.update({ where: { id: req.id }, data: { assignedToId: assignee?.id ?? null, status: to, accountId: actor.accountId, propertyId } });
    await tx.maintenanceUpdate.create({
      data: { requestId: req.id, actorId: actor.id, actorRole: actor.role, actorName: await actorName(actor), statusFrom: from !== to ? from : null, statusTo: from !== to ? to : null, assignedToId: assignee?.id ?? null, note: assignee ? `Assigned to ${assignee.name}` : "Unassigned", visibleToTenant: true },
    });
    await audit(tx, actor, { entityType: "MaintenanceRequest", entityId: req.id, action: "maintenance_assigned", propertyId, tenantId: req.tenantId, details: { assignedToId: assignee?.id ?? null } });
    return saved;
  });
}

/**
 * Change status and/or add a note. Admins and assigned caretakers only;
 * each move is checked against allowedMoves. The status write is
 * conditional on the status read, so two people can't both move it.
 */
export async function updateRequest(actor: Actor, requestId: string, input: { status?: unknown; note?: unknown; visibleToTenant?: unknown; priority?: unknown }) {
  if (actor.kind !== "ADMIN" && actor.kind !== "CARETAKER") throw forbidden();
  const { req, propertyId } = await loadForActor(actor, requestId);
  const from = normalizeStatus(req.status);
  const to = input.status == null || input.status === "" ? null : (STATUSES as readonly unknown[]).includes(input.status) ? (input.status as MaintenanceStatus) : null;
  if (input.status && !to) throw invalid("Unknown status");
  if (to && to !== from && !allowedMoves(actor.kind, from).includes(to)) throw conflict(`Can't move from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}`);
  const note = optionalText(input.note, 4000);
  const priority = actor.kind === "ADMIN" && input.priority ? parsePriority(input.priority) : null;
  if (!note && (!to || to === from) && !priority) throw invalid("Add a note or choose a new status");
  // Caretaker notes are visible to the tenant only when the office says so.
  const visibleToTenant = actor.kind === "ADMIN" ? input.visibleToTenant !== false : false;
  return inTransaction(async (tx) => {
    if (to && to !== from) {
      const moved = await tx.maintenanceRequest.updateMany({
        where: { id: req.id, status: req.status },
        data: {
          status: to,
          ...(to === "COMPLETED" ? { resolvedAt: new Date() } : {}),
          ...(to === "CLOSED" ? { closedAt: new Date() } : {}),
          ...(from === "CLOSED" ? { closedAt: null } : {}),
        },
      });
      if (moved.count === 0) throw conflict("Someone else just updated this request — refresh and try again");
    }
    if (priority && priority !== req.priority) await tx.maintenanceRequest.update({ where: { id: req.id }, data: { priority } });
    const update = await tx.maintenanceUpdate.create({
      data: {
        requestId: req.id,
        actorId: actor.id,
        actorRole: actor.role,
        actorName: await actorName(actor),
        statusFrom: to && to !== from ? from : null,
        statusTo: to && to !== from ? to : null,
        note: note ?? (priority && priority !== req.priority ? `Priority set to ${priority}` : null),
        visibleToTenant,
      },
    });
    await audit(tx, actor, { entityType: "MaintenanceRequest", entityId: req.id, action: "maintenance_updated", propertyId, tenantId: req.tenantId, details: { from, to, note: !!note } });
    return update;
  });
}

/** Tenant: add a note to their own open request. */
export async function tenantNote(actor: Actor, requestId: string, noteRaw: unknown) {
  const { req, propertyId } = await loadForActor(actor, requestId);
  if (normalizeStatus(req.status) === "CLOSED") throw conflict("This request is closed. Send the office a message or open a new request.");
  const note = requireText(noteRaw, "Note", 2000);
  return prisma.maintenanceUpdate.create({ data: { requestId: req.id, actorId: actor.id, actorRole: actor.role, actorName: await actorName(actor), note, visibleToTenant: true } }).then(async (u) => {
    await prisma.billingAuditLog.create({ data: { accountId: actor.accountId, propertyId, tenantId: req.tenantId, entityType: "MaintenanceRequest", entityId: req.id, action: "maintenance_tenant_note", actorId: actor.id, actorRole: actor.role } });
    return u;
  });
}

/**
 * Photo on a request (tenant, assigned caretaker or admin). Stored privately;
 * readable by the office, the tenant of the request, and caretakers of the property.
 */
export async function addPhoto(actor: Actor, requestId: string, file: File | null, caption?: unknown) {
  if (actor.kind === "SYSTEM") throw forbidden();
  const { req, propertyId } = await loadForActor(actor, requestId);
  if (!propertyId) throw invalid("This request isn't linked to a property");
  const upload = await readUpload(file);
  if (upload.kind.mime === "application/pdf") throw invalid("Upload a photo (JPG, PNG or WEBP)");
  const stored = await storeFile({ actor, accountId: actor.accountId, propertyId, tenantId: req.tenantId, purpose: "MAINTENANCE_PHOTO", file: file! }, upload);
  return prisma.maintenanceUpdate.create({
    data: {
      requestId: req.id,
      actorId: actor.id,
      actorRole: actor.role,
      actorName: await actorName(actor),
      note: optionalText(caption, 500) ?? "Photo added",
      photoFileIds: [stored.id] as Prisma.InputJsonValue,
      visibleToTenant: actor.kind !== "CARETAKER",
    },
  });
}

/** One request with its history, filtered for the viewer. */
export async function requestDetail(actor: Actor, requestId: string) {
  const { req, propertyId } = await loadForActor(actor, requestId);
  const updates = await prisma.maintenanceUpdate.findMany({
    where: { requestId: req.id, ...(actor.kind === "TENANT" ? { visibleToTenant: true } : {}) },
    orderBy: { createdAt: "asc" },
  });
  const [property, unit, assignee] = await Promise.all([
    propertyId ? prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, name: true } }) : null,
    req.unitId ?? req.tenant?.unitId ? prisma.unit.findUnique({ where: { id: (req.unitId ?? req.tenant?.unitId)! }, select: { id: true, unitNumber: true } }) : null,
    req.assignedToId ? prisma.user.findUnique({ where: { id: req.assignedToId }, select: { id: true, name: true } }) : null,
  ]);
  return {
    request: {
      id: req.id,
      title: req.title,
      description: req.description,
      priority: req.priority,
      category: req.category,
      status: normalizeStatus(req.status),
      createdAt: req.createdAt.toISOString(),
      resolvedAt: req.resolvedAt?.toISOString() ?? null,
      source: req.source ?? "TENANT",
    },
    property,
    unit,
    // Caretakers get the room, never the tenant's identity or contact details.
    tenant: actor.kind === "ADMIN" && req.tenant ? { id: req.tenant.id, name: req.tenant.name, phone: req.tenant.phone } : null,
    assignee,
    updates: updates.map((u) => ({
      id: u.id,
      at: u.createdAt.toISOString(),
      by: u.actorRole === "TENANT" ? (actor.kind === "CARETAKER" ? "Tenant" : u.actorName) : u.actorName,
      role: u.actorRole,
      statusFrom: u.statusFrom ? normalizeStatus(u.statusFrom) : null,
      statusTo: u.statusTo ? normalizeStatus(u.statusTo) : null,
      note: u.note,
      photoFileIds: (u.photoFileIds as string[] | null) ?? [],
      visibleToTenant: u.visibleToTenant,
    })),
    moves: actor.kind === "ADMIN" || actor.kind === "CARETAKER" ? allowedMoves(actor.kind, normalizeStatus(req.status)) : [],
  };
}

/** Lists for the office, a caretaker, or a tenant. */
export async function listRequests(actor: Actor, filter: { propertyId?: string | null; status?: "open" | "all" | MaintenanceStatus } = {}) {
  const status = filter.status ?? "open";
  const statusWhere: Prisma.MaintenanceRequestWhereInput = status === "all" ? {} : status === "open" ? { status: { in: OPEN_RAW } } : { status: { in: rawStatuses([status]) } };
  let scope: Prisma.MaintenanceRequestWhereInput;
  if (actor.kind === "ADMIN") scope = { AND: [accountScope(actor.accountId), ...(filter.propertyId ? [propertyScope(filter.propertyId)] : [])] };
  else if (actor.kind === "CARETAKER") {
    const ids = await caretakerPropertyIds(actor);
    scope = { assignedToId: actor.id, OR: [{ propertyId: { in: ids } }, { propertyId: null, tenant: { unit: { propertyId: { in: ids } } } }] };
  } else if (actor.kind === "TENANT") scope = { tenantId: actor.tenantId };
  else throw forbidden();
  const rows = await prisma.maintenanceRequest.findMany({
    where: { AND: [scope, statusWhere] },
    include: { tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  const unitIds = [...new Set(rows.map((r) => r.unitId).filter(Boolean) as string[])];
  const units = new Map((await prisma.unit.findMany({ where: { id: { in: unitIds } }, select: { id: true, unitNumber: true } })).map((u) => [u.id, u.unitNumber]));
  const assignees = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.assignedToId).filter(Boolean) as string[] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: normalizeStatus(r.status),
      priority: r.priority,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      room: r.tenant?.unit.unitNumber ?? (r.unitId ? units.get(r.unitId) ?? null : null),
      tenantName: actor.kind === "ADMIN" ? r.tenant?.name ?? null : null,
      assignee: r.assignedToId ? assignees.get(r.assignedToId) ?? null : null,
    }))
    .sort((a, b) => (OPEN.includes(a.status) === OPEN.includes(b.status) ? (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2) || b.createdAt.localeCompare(a.createdAt) : OPEN.includes(a.status) ? -1 : 1));
}

/** People an administrator can assign at a property: its caretakers plus staff. */
export async function assignees(actor: Actor, propertyId: string) {
  requireAdmin(actor);
  const users = await prisma.user.findMany({ where: { accountId: actor.accountId }, include: { caretakerProperties: { select: { propertyId: true } } }, orderBy: { name: "asc" } });
  return users.filter((u) => u.role !== "CARETAKER" || u.caretakerProperties.some((c) => c.propertyId === propertyId)).map((u) => ({ id: u.id, name: u.name, role: u.role }));
}
