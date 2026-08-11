import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { tenantUpdateSchema } from "@/lib/validations";
import type { z } from "zod";

export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;

export class PhoneTakenError extends Error {}

// Shared by the tenant edit form (app/api/tenants/[id] PATCH) and the chat
// assistant. Only touches fields actually present in `data` — the edit form
// always submits every field so this is equivalent to the old always-set
// behavior there, but it also makes single-field chat updates (e.g. "just
// change the phone") safe instead of nulling out everything else omitted.
export async function applyTenantUpdate(tenantId: string, currentPhone: string, data: TenantUpdateInput) {
  if (data.phone && data.phone !== currentPhone) {
    const existing = await prisma.tenant.findUnique({ where: { phone: data.phone } });
    if (existing) throw new PhoneTakenError("Phone number already registered");
  }

  const update: Record<string, unknown> = {};
  if ("name" in data) update.name = data.name;
  if ("email" in data) update.email = data.email || null;
  if ("phone" in data) update.phone = data.phone;
  if ("moveInDate" in data) update.moveInDate = data.moveInDate ? new Date(data.moveInDate) : undefined;
  if ("moveOutDate" in data) update.moveOutDate = data.moveOutDate ? new Date(data.moveOutDate) : null;
  if ("dueDay" in data) update.dueDay = data.dueDay;
  if ("depositAmount" in data) update.depositAmount = data.depositAmount != null ? Number(data.depositAmount) : null;
  if ("depositPaid" in data) update.depositPaid = data.depositPaid;
  if ("portalPin" in data && data.portalPin) update.portalPin = await bcrypt.hash(data.portalPin, 10);
  if ("emergencyContact" in data) update.emergencyContact = data.emergencyContact || null;
  if ("notes" in data) update.notes = data.notes || null;
  if ("isActive" in data) update.isActive = data.isActive;

  return prisma.tenant.update({ where: { id: tenantId }, data: update });
}
