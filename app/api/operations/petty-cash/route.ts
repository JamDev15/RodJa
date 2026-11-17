import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { disburse, recordCount, topUp } from "@/lib/finance/pettycash";
import { formFile, formObject, isMultipart } from "@/lib/operations/http";

/** Spend (multipart, with receipt), top up or record a count (JSON). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    if (isMultipart(req)) {
      const form = await req.formData();
      return disburse(actor, formObject(form), formFile(form, "file", false));
    }
    const { action, ...body } = await jsonBody(req);
    if (action === "top_up") return topUp(actor, body);
    if (action === "count") return recordCount(actor, body);
    throw invalid("Unknown action");
  }, 201);
}
