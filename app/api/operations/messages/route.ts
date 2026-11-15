import { handle } from "@/lib/collections/http";
import { startThread } from "@/lib/operations/messages";
import { formFile, formValues } from "@/lib/operations/http";

/** Start a conversation (multipart: subject, body, optional file, tenantId). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await formValues(req);
    return startThread(actor, { tenantId: String(form.get("tenantId") ?? ""), subject: form.get("subject"), body: form.get("body"), file: formFile(form, "file", false) });
  }, 201);
}
