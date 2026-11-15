import { handle } from "@/lib/collections/http";
import { uploadLeaseDocument } from "@/lib/operations/leases";
import { formFile, formValues } from "@/lib/operations/http";

/** Tenant uploads the signed copy of their lease (print → sign → upload). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await formValues(req);
    return uploadLeaseDocument(actor, { kind: "SIGNED_COPY", title: form.get("title"), leaseTermId: form.get("leaseTermId"), file: formFile(form, "file") });
  }, 201);
}
