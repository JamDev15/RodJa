// Caretaker accounts: a User with role CARETAKER, assigned to properties.
// They can sign in and enter water meter readings — nothing else.

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, type Actor } from "./actor";
import { audit, inTransaction } from "./db";
import { conflict, invalid, notFound } from "./errors";

export async function listCaretakers(actor: Actor) {
  requireAdmin(actor);
  return prisma.user.findMany({
    where: { accountId: actor.accountId, role: "CARETAKER" },
    select: { id: true, name: true, email: true, createdAt: true, caretakerProperties: { select: { propertyId: true, property: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createCaretaker(actor: Actor, input: { name: string; email: string; password: string; propertyIds: string[] }) {
  requireAdmin(actor);
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) throw invalid("Name is required");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("A valid email is required");
  if (!input.password || input.password.length < 8) throw invalid("Password must be at least 8 characters");
  if (!input.propertyIds?.length) throw invalid("Assign at least one property");
  const props = await prisma.property.findMany({ where: { id: { in: input.propertyIds }, accountId: actor.accountId }, select: { id: true } });
  if (props.length !== new Set(input.propertyIds).size) throw notFound("Property not found");
  // Login checks super admins, then landlord accounts, then users by email,
  // so the address must be unused everywhere.
  const [a, b, c] = await Promise.all([
    prisma.superAdmin.findUnique({ where: { email } }),
    prisma.account.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (a || b || c) throw conflict("That email is already used by another login");
  const password = await bcrypt.hash(input.password, 10);
  return inTransaction(async (tx) => {
    const user = await tx.user.create({ data: { accountId: actor.accountId, email, name: name.slice(0, 80), password, role: "CARETAKER" } });
    await tx.caretakerProperty.createMany({ data: props.map((p) => ({ userId: user.id, propertyId: p.id })) });
    await audit(tx, actor, { entityType: "User", entityId: user.id, action: "caretaker_created", details: { email, propertyIds: props.map((p) => p.id) } });
    return { id: user.id, name: user.name, email: user.email };
  });
}

export async function removeCaretaker(actor: Actor, userId: string) {
  requireAdmin(actor);
  const user = await prisma.user.findFirst({ where: { id: userId, accountId: actor.accountId, role: "CARETAKER" } });
  if (!user) throw notFound("Caretaker not found");
  return inTransaction(async (tx) => {
    await tx.caretakerProperty.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
    await audit(tx, actor, { entityType: "User", entityId: userId, action: "caretaker_removed", details: { email: user.email } });
  });
}
