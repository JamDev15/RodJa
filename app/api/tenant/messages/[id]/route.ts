import { handle } from "@/lib/collections/http";
import { reply } from "@/lib/operations/messages";
import { formFile, formValues } from "@/lib/operations/http";

/** Reply (multipart: body, optional file). */
export async function POST(req: Request, ctx: RouteContext<"/api/tenant/messages/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const form = await formValues(req);
    return reply(actor, id, { body: form.get("body"), file: formFile(form, "file", false) });
  });
}
