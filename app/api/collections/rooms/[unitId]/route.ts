import { handle, jsonBody } from "@/lib/collections/http";
import { addRecurringCharge, updateRoomSettings } from "@/lib/collections/rooms";

/** { action: "settings", ... } or { action: "add_recurring", ... } */
export async function POST(req: Request, ctx: RouteContext<"/api/collections/rooms/[unitId]">) {
  const { unitId } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "add_recurring") return addRecurringCharge(actor, unitId, body as never);
    return updateRoomSettings(actor, unitId, body as never);
  });
}
