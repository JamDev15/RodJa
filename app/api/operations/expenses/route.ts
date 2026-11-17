import { handle } from "@/lib/collections/http";
import { recordExpense } from "@/lib/finance/expenses";
import { formFile, formObject, formValues } from "@/lib/operations/http";

/** Record an expense (multipart: fields + optional receipt file). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await formValues(req);
    return recordExpense(actor, formObject(form), formFile(form, "file", false));
  }, 201);
}
