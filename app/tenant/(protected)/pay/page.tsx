import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantPayForm } from "./pay-form";

export default async function TenantPayPage() {
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId;
  // Properties on statement billing take payments against statements.
  const billing = tenantId
    ? await prisma.billingProfile.findFirst({ where: { enabled: true, property: { units: { some: { tenants: { some: { id: tenantId } } } } } }, select: { id: true } })
    : null;
  if (billing) redirect("/tenant/billing");
  return <TenantPayForm />;
}
