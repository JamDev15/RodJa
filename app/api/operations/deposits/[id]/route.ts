import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { reverseDepositTransaction } from "@/lib/operations/deposits";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/deposits/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "reverse") return reverseDepositTransaction(actor, id, body.reason);
    throw invalid("Unknown action");
  });
}
