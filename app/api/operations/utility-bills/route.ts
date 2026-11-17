import { handle } from "@/lib/collections/http";
import { recordUtilityBill } from "@/lib/finance/utilities";
import { formFile, formObject, formValues } from "@/lib/operations/http";

/** Record a master water / common-area electricity bill (multipart, optional bill scan). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await formValues(req);
    return recordUtilityBill(actor, formObject(form), formFile(form, "file", false));
  }, 201);
}
