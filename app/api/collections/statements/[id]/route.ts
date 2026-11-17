import { handle, jsonBody, num, str } from "@/lib/collections/http";
import { invalid } from "@/lib/collections/errors";
import { sendStatementNow } from "@/lib/collections/notify";
import { addDraftCharge, discardDraft, publishStatement } from "@/lib/collections/statements";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/statements/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const body = await jsonBody(req);
    switch (body.action) {
      case "publish":
        return publishStatement(actor, id);
      case "discard":
        return discardDraft(actor, id);
      case "send":
        return sendStatementNow(actor, id);
      case "add_charge":
        return addDraftCharge(actor, id, { type: body.type === "PARKING" ? "PARKING" : "MISC", description: str(body.description), amountCentavos: num(body.amountCentavos) });
      default:
        throw invalid("Unknown action");
    }
  });
}
