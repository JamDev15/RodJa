import { handle, jsonBody, optStr } from "@/lib/collections/http";
import { reviewVecoReceipt } from "@/lib/collections/veco";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/veco/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const body = await jsonBody(req);
    return reviewVecoReceipt(actor, id, body.decision === "VERIFY" ? "VERIFY" : "REJECT", optStr(body.reason) ?? undefined);
  });
}
