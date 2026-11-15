import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { addPhoto, tenantNote } from "@/lib/operations/maintenance";
import { formFile } from "@/lib/operations/http";

/** Tenant adds a note (JSON) or a photo (multipart) to their own request. */
export async function POST(req: Request, ctx: RouteContext<"/api/tenant/maintenance/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      return addPhoto(actor, id, formFile(form, "file"), form.get("caption"));
    }
    const { action, ...body } = await jsonBody(req);
    if (action === "note") return tenantNote(actor, id, body.note);
    throw invalid("Unknown action");
  });
}
