import { handle, jsonBody } from "@/lib/collections/http";
import { createTenantRequest } from "@/lib/operations/maintenance";
import { maintenanceSubmitted } from "@/lib/messenger/events";

/** Older tenant endpoint; same behaviour as POST /api/tenant/maintenance. */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const created = await createTenantRequest(actor, await jsonBody(req));
    await maintenanceSubmitted(created.id).catch(() => undefined);
    return created;
  }, 201);
}
