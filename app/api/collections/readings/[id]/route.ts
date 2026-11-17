import { handle, jsonBody, str } from "@/lib/collections/http";
import { voidMeterReading } from "@/lib/collections/meters";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/readings/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => voidMeterReading(actor, id, str((await jsonBody(req)).reason)));
}
