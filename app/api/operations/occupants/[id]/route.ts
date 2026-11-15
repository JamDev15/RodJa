import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { moveOutOccupant, updateOccupant } from "@/lib/operations/occupants";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/occupants/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "update") return updateOccupant(actor, id, body);
    if (action === "move_out") return moveOutOccupant(actor, id, body.movedOutOn);
    throw invalid("Unknown action");
  });
}
