// Shared helpers for Phase 2 (tenancy lifecycle and operations).
//
// Every service takes the same Actor as collections billing and enforces its
// own scoping: administrators see their account, tenants their own tenancy,
// caretakers only what is assigned to them.

import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "@/lib/collections/actor";
import { dateIn, isValidDate, todayIn, type DateOnly } from "@/lib/collections/calendar";
import { forbidden, invalid, notFound } from "@/lib/collections/errors";

export const TZ = "Asia/Manila";

export function today(): DateOnly {
  return todayIn(TZ);
}

export function toDateOnly(d: Date): DateOnly {
  return dateIn(TZ, d);
}

export function requireDate(value: unknown, label: string): DateOnly {
  if (typeof value !== "string" || !isValidDate(value)) throw invalid(`${label}: enter a valid date`);
  return value;
}

export function optionalDate(value: unknown, label: string): DateOnly | null {
  if (value == null || value === "") return null;
  return requireDate(value, label);
}

export function requireText(value: unknown, label: string, max = 500): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw invalid(`${label} is required`);
  if (v.length > max) throw invalid(`${label} is too long (max ${max} characters)`);
  return v;
}

export function optionalText(value: unknown, max = 2000): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return null;
  if (v.length > max) throw invalid(`Text is too long (max ${max} characters)`);
  return v;
}

/** A tenancy in the administrator's account, with its room and property. */
export async function adminTenant(actor: Actor | null, tenantId: string) {
  requireAdmin(actor);
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, unit: { property: { accountId: actor.accountId } } },
    include: { unit: { include: { property: true } } },
  });
  if (!tenant) throw notFound("Tenant not found");
  return tenant;
}

/** The signed-in tenant's own tenancy. */
export async function ownTenancy(actor: Actor | null) {
  if (!actor || actor.kind !== "TENANT") throw forbidden();
  const tenant = await prisma.tenant.findFirst({
    where: { id: actor.tenantId, unit: { property: { accountId: actor.accountId } } },
    include: { unit: { include: { property: true } } },
  });
  if (!tenant) throw notFound("Tenancy not found");
  return tenant;
}

/** Display name of whoever is acting, for history lines. */
export async function actorName(actor: Actor): Promise<string> {
  switch (actor.kind) {
    case "TENANT":
      return (await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { name: true } }))?.name ?? "Tenant";
    case "CARETAKER":
      return (await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name ?? "Caretaker";
    case "ADMIN":
      if (actor.role === "STAFF") return (await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name ?? "Office";
      return (await prisma.account.findUnique({ where: { id: actor.accountId }, select: { ownerName: true } }))?.ownerName ?? "Office";
    default:
      return "System";
  }
}
