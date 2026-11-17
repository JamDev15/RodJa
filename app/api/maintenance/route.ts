import { handle, jsonBody } from "@/lib/collections/http";
import { createTenantRequest } from "@/lib/operations/maintenance";

/** Older tenant endpoint; same behaviour as POST /api/tenant/maintenance. */
export async function POST(req: Request) {
  return handle(async (actor) => createTenantRequest(actor, await jsonBody(req)), 201);
}
