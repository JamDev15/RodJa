import { prisma } from "@/lib/prisma";
import type { TenantOption } from "./contract-editor";

export async function loadTenantOptions(accountId: string, includeTenantId?: string): Promise<TenantOption[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      unit: { property: { accountId } },
      OR: [{ isActive: true }, ...(includeTenantId ? [{ id: includeTenantId }] : [])],
    },
    include: { unit: { include: { property: true } } },
    orderBy: { name: "asc" },
  });
  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    unitNumber: t.unit.unitNumber,
    propertyName: t.unit.property.name,
    propertyAddress: t.unit.property.address,
    rentAmount: t.unit.rentAmount,
    depositAmount: t.depositAmount ?? t.unit.depositAmount ?? null,
    dueDay: t.dueDay,
    moveInDate: t.moveInDate.toISOString().slice(0, 10),
  }));
}
