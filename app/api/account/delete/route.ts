import { handle, jsonBody } from "@/lib/collections/http";
import { deleteOwnAccount } from "@/lib/account/self-service";

/** Account owner deletes their account and all its data. */
export async function POST(req: Request) {
  return handle(async (actor) => deleteOwnAccount(actor, await jsonBody(req)));
}
