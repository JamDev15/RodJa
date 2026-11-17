import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { createTenantRequest } from "@/lib/operations/maintenance";

/** The signed-in tenant's own requests (raw rows; the page normalizes statuses). */
export async function GET() {
  return handle(async (actor) => {
    if (actor.kind !== "TENANT") throw forbidden();
    return prisma.maintenanceRequest.findMany({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: "desc" } });
  });
}

/** Tenant reports a problem in their room (status starts at SUBMITTED). */
export async function POST(req: Request) {
  return handle(async (actor) => createTenantRequest(actor, await jsonBody(req)), 201);
}
