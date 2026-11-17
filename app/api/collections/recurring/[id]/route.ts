import { handle, jsonBody, optStr } from "@/lib/collections/http";
import { endRecurringCharge } from "@/lib/collections/rooms";

/** End a recurring charge after a month ({ endMonth }) or stop it now ({ endMonth: null }). */
export async function POST(req: Request, ctx: RouteContext<"/api/collections/recurring/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => endRecurringCharge(actor, id, optStr((await jsonBody(req)).endMonth)));
}
