import { removeCaretaker } from "@/lib/collections/caretakers";
import { handle } from "@/lib/collections/http";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/collections/caretakers/[id]">) {
  const { id } = await ctx.params;
  return handle((actor) => removeCaretaker(actor, id));
}
