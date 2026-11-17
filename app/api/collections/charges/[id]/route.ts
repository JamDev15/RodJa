import { adjustCharge } from "@/lib/collections/adjustments";
import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody, num, str } from "@/lib/collections/http";
import { removeDraftCharge } from "@/lib/collections/statements";

/** Waive or reduce an issued charge (with a reason). */
export async function POST(req: Request, ctx: RouteContext<"/api/collections/charges/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const body = await jsonBody(req);
    if (body.kind !== "WAIVER" && body.kind !== "REDUCTION") throw invalid("Choose waive or reduce");
    return adjustCharge(actor, id, { kind: body.kind, amountCentavos: body.kind === "REDUCTION" ? num(body.amountCentavos) : undefined, reason: str(body.reason) });
  });
}

/** Remove a line from a draft statement. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/collections/charges/[id]">) {
  const { id } = await ctx.params;
  return handle((actor) => removeDraftCharge(actor, id));
}
