import { handle, jsonBody } from "@/lib/collections/http";
import { deleteTenantLogin } from "@/lib/account/self-service";

/** Tenant deletes their portal login and app data. */
export async function POST(req: Request) {
  return handle(async (actor) => deleteTenantLogin(actor, await jsonBody(req)));
}
