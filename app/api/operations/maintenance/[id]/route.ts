import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { addPhoto, assignRequest, updateRequest } from "@/lib/operations/maintenance";
import { formFile } from "@/lib/operations/http";

/** Status/notes (JSON) or a photo (multipart). Assignment is admin-only, enforced in the service. */
export async function POST(req: Request, ctx: RouteContext<"/api/operations/maintenance/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      return addPhoto(actor, id, formFile(form, "file"), form.get("caption"));
    }
    const { action, ...body } = await jsonBody(req);
    if (action === "assign") return assignRequest(actor, id, body.assignedToId);
    if (action === "update") return updateRequest(actor, id, body);
    throw invalid("Unknown action");
  });
}
