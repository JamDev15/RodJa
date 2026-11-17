import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { voidMasterReading } from "@/lib/finance/utilities";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/master-readings/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "void") return voidMasterReading(actor, id, body.reason);
    throw invalid("Unknown action");
  });
}
