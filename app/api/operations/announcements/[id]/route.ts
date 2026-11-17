import { handle } from "@/lib/collections/http";
import { deleteAnnouncement } from "@/lib/operations/announcements";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/operations/announcements/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => deleteAnnouncement(actor, id));
}
