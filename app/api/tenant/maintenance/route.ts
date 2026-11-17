import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { createTenantRequest } from "@/lib/operations/maintenance";
import { maintenanceSubmitted } from "@/lib/messenger/events";

/** The signed-in tenant's own requests (raw rows; the page normalizes statuses). */
export async function GET() {
  return handle(async (actor) => {
    if (actor.kind !== "TENANT") throw forbidden();
    return prisma.maintenanceRequest.findMany({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: "desc" } });
  });
}

/** Tenant reports a problem in their room (status starts at SUBMITTED). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const created = await createTenantRequest(actor, await jsonBody(req));
    await maintenanceSubmitted(created.id).catch(() => undefined);
    return created;
  }, 201);
}
