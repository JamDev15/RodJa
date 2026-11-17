import { handle, jsonBody } from "@/lib/collections/http";
import { createAdminRequest } from "@/lib/operations/maintenance";

/** Office logs a request for a room or a common area. */
export async function POST(req: Request) {
  return handle(async (actor) => createAdminRequest(actor, await jsonBody(req)), 201);
}
