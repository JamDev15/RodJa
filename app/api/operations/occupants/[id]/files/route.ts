import { handle } from "@/lib/collections/http";
import { attachOccupantFile } from "@/lib/operations/occupants";
import { formFile, formValues } from "@/lib/operations/http";

/** ID document or photo for an occupant (admins only; stored privately). */
export async function POST(req: Request, ctx: RouteContext<"/api/operations/occupants/[id]/files">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const form = await formValues(req);
    return attachOccupantFile(actor, id, form.get("which") === "photo" ? "photo" : "id", formFile(form, "file"));
  }, 201);
}
