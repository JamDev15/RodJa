import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { renewLease } from "@/lib/operations/leases";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/leases/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "renew") return renewLease(actor, id, body);
    throw invalid("Unknown action");
  });
}
