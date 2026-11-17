import { reverseAdjustment } from "@/lib/collections/adjustments";
import { handle, jsonBody, str } from "@/lib/collections/http";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/adjustments/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => reverseAdjustment(actor, id, str((await jsonBody(req)).reason)));
}
