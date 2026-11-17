import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { reversePettyCash } from "@/lib/finance/pettycash";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/petty-cash/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "reverse") return reversePettyCash(actor, id, body.reason);
    throw invalid("Unknown action");
  });
}
