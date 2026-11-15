import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { addItem, completeChecklist, reopenChecklist } from "@/lib/operations/checklists";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/checklists/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "add_item") return addItem(actor, id, body);
    if (action === "complete") return completeChecklist(actor, id);
    if (action === "reopen") return reopenChecklist(actor, id, body.reason);
    throw invalid("Unknown action");
  });
}
