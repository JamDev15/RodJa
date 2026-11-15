import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentActor, type Actor } from "./actor";

/** Signed-in admin + the property a collections page is about. */
export async function adminPageContext(propertyIdParam?: string | null) {
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const properties = await prisma.property.findMany({
    where: { accountId: actor.accountId },
    select: { id: true, name: true, billingProfile: { select: { enabled: true } } },
    orderBy: { name: "asc" },
  });
  const chosen =
    properties.find((p) => p.id === propertyIdParam) ?? properties.find((p) => p.billingProfile?.enabled) ?? properties.find((p) => p.billingProfile) ?? properties[0] ?? null;
  return { actor: actor as Actor, properties: properties.map((p) => ({ id: p.id, name: p.name })), propertyId: chosen?.id ?? null };
}
