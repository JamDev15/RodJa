import { handle, jsonBody } from "@/lib/collections/http";
import { attachItemPhoto, setItem } from "@/lib/operations/checklists";
import { formFile } from "@/lib/operations/http";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/checklist-items/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      return attachItemPhoto(actor, id, formFile(await req.formData(), "file"));
    }
    return setItem(actor, id, await jsonBody(req));
  });
}
