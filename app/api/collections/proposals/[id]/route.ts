import { handle, jsonBody, optStr } from "@/lib/collections/http";
import { decideExcessProposal } from "@/lib/collections/meters";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/proposals/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const body = await jsonBody(req);
    return decideExcessProposal(actor, id, body.decision === "APPROVE" ? "APPROVE" : "REJECT", optStr(body.note) ?? undefined);
  });
}
