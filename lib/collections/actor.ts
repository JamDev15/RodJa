import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "./errors";

/**
 * Who is acting. Every collections service takes an Actor and enforces its
 * own scoping, so authorization never depends on a page hiding a button.
 *  - ADMIN: the landlord account owner or a STAFF user (full account access,
 *    as STAFF already had before this feature).
 *  - CARETAKER: may only read room/meter info and enter meter readings for
 *    properties assigned to them — no payments, balances, or reports.
 *  - TENANT: only their own tenancy's records.
 *  - SYSTEM: scheduled jobs.
 */
export type Actor =
  | { kind: "ADMIN"; id: string; role: "LANDLORD" | "STAFF"; accountId: string }
  | { kind: "CARETAKER"; id: string; role: "CARETAKER"; accountId: string }
  | { kind: "TENANT"; id: string; role: "TENANT"; accountId: string; tenantId: string }
  | { kind: "SYSTEM"; id: "system"; role: "SYSTEM"; accountId: string };

export function systemActor(accountId: string): Actor {
  return { kind: "SYSTEM", id: "system", role: "SYSTEM", accountId };
}

export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; accountId?: string; tenantId?: string } | undefined;
  if (!u?.role || !u.accountId || !u.id) return null;
  if (u.role === "LANDLORD" || u.role === "STAFF") return { kind: "ADMIN", id: u.id, role: u.role, accountId: u.accountId };
  if (u.role === "CARETAKER") return { kind: "CARETAKER", id: u.id, role: "CARETAKER", accountId: u.accountId };
  if (u.role === "TENANT" && u.tenantId) return { kind: "TENANT", id: u.tenantId, role: "TENANT", accountId: u.accountId, tenantId: u.tenantId };
  return null;
}

export function requireAdmin(actor: Actor | null): asserts actor is Extract<Actor, { kind: "ADMIN" | "SYSTEM" }> {
  if (!actor || (actor.kind !== "ADMIN" && actor.kind !== "SYSTEM")) throw forbidden();
}

export function requireTenant(actor: Actor | null): asserts actor is Extract<Actor, { kind: "TENANT" }> {
  if (!actor || actor.kind !== "TENANT") throw forbidden();
}

/** The property, if it belongs to the actor's account (admins/system). */
export async function adminProperty(actor: Actor | null, propertyId: string) {
  requireAdmin(actor);
  const property = await prisma.property.findFirst({ where: { id: propertyId, accountId: actor.accountId } });
  if (!property) throw notFound("Property not found");
  return property;
}

/** Property ids a caretaker is assigned to (empty for anyone else). */
export async function caretakerPropertyIds(actor: Actor | null): Promise<string[]> {
  if (!actor || actor.kind !== "CARETAKER") return [];
  const rows = await prisma.caretakerProperty.findMany({
    where: { userId: actor.id, property: { accountId: actor.accountId } },
    select: { propertyId: true },
  });
  return rows.map((r) => r.propertyId);
}

/** Admin of the account, or a caretaker assigned to this property. */
export async function requireMeterAccess(actor: Actor | null, propertyId: string) {
  if (!actor) throw forbidden();
  if (actor.kind === "ADMIN" || actor.kind === "SYSTEM") return adminProperty(actor, propertyId);
  if (actor.kind === "CARETAKER") {
    const ids = await caretakerPropertyIds(actor);
    if (!ids.includes(propertyId)) throw forbidden();
    const property = await prisma.property.findFirst({ where: { id: propertyId, accountId: actor.accountId } });
    if (!property) throw notFound("Property not found");
    return property;
  }
  throw forbidden();
}
