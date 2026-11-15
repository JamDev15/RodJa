import { handle } from "@/lib/collections/http";
import { uploadLeaseDocument } from "@/lib/operations/leases";
import { formFile, formValues } from "@/lib/operations/http";

/** Administrator uploads a lease file for this tenancy (multipart). */
export async function POST(req: Request, ctx: RouteContext<"/api/operations/tenancies/[id]/documents">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const form = await formValues(req);
    return uploadLeaseDocument(actor, { tenantId: id, kind: form.get("kind"), title: form.get("title"), leaseTermId: form.get("leaseTermId"), file: formFile(form, "file") });
  }, 201);
}
