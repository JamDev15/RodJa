// Self-service account deletion (App Store guideline 5.1.1(v), Google Play
// account-deletion policy).
//
// - Landlord (account owner): deletes the whole account and everything in
//   it, after re-entering the password and typing DELETE.
// - Tenant: tenancy records (rent, payments, leases) belong to the landlord's
//   business records, so they are kept for the landlord; what the tenant can
//   delete is their portal login and app data — the PIN is replaced with an
//   unusable one, phone-app devices and Messenger links are removed, and the
//   office is told in a message so they can also erase contact details.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/collections/actor";
import { forbidden, invalid } from "@/lib/collections/errors";
import { deleteAccountData } from "@/lib/account-deletion";

export async function deleteOwnAccount(actor: Actor | null, input: { password?: unknown; confirm?: unknown }) {
  if (!actor || actor.kind !== "ADMIN" || actor.role !== "LANDLORD" || actor.id !== actor.accountId) throw forbidden();
  if (input.confirm !== "DELETE") throw invalid("Type DELETE to confirm");
  const account = await prisma.account.findUnique({ where: { id: actor.accountId }, select: { password: true } });
  if (!account || typeof input.password !== "string" || !(await bcrypt.compare(input.password, account.password))) throw invalid("Password is incorrect");
  await deleteAccountData(actor.accountId);
  return { deleted: true };
}

export async function deleteTenantLogin(actor: Actor | null, input: { pin?: unknown; confirm?: unknown }) {
  if (!actor || actor.kind !== "TENANT") throw forbidden();
  if (input.confirm !== "DELETE") throw invalid("Type DELETE to confirm");
  const tenant = await prisma.tenant.findFirst({ where: { id: actor.tenantId, unit: { property: { accountId: actor.accountId } } }, include: { unit: true } });
  if (!tenant) throw forbidden();
  const pin = typeof input.pin === "string" ? input.pin : "";
  const ok = tenant.portalPin.startsWith("$2") ? await bcrypt.compare(pin, tenant.portalPin) : tenant.portalPin === pin;
  if (!ok) throw invalid("PIN is incorrect");
  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: tenant.id }, data: { portalPin: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10) } });
    await tx.deviceToken.deleteMany({ where: { tenantId: tenant.id } });
    await tx.messengerLink.deleteMany({ where: { tenantId: tenant.id } });
    const now = new Date();
    const thread = await tx.messageThread.create({
      data: { accountId: actor.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, subject: "Portal account deleted", lastMessageAt: now, lastSenderRole: "TENANT", tenantReadAt: now },
    });
    await tx.threadMessage.create({
      data: {
        threadId: thread.id,
        senderRole: "TENANT",
        senderId: tenant.id,
        senderName: tenant.name,
        body: "I deleted my tenant portal login from the app. Please also remove my personal contact details that you don't need to keep for your records.",
      },
    });
    await tx.billingAuditLog.create({ data: { accountId: actor.accountId, propertyId: tenant.unit.propertyId, tenantId: tenant.id, entityType: "Tenant", entityId: tenant.id, action: "tenant_portal_login_deleted", actorId: tenant.id, actorRole: "TENANT" } });
  });
  return { deleted: true };
}
