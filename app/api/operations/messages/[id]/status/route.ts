import { handle, jsonBody } from "@/lib/collections/http";
import { setThreadStatus } from "@/lib/operations/messages";

/** Close or reopen a conversation (office only). */
export async function POST(req: Request, ctx: RouteContext<"/api/operations/messages/[id]/status">) {
  const { id } = await ctx.params;
  return handle(async (actor) => setThreadStatus(actor, id, (await jsonBody(req)).status));
}
