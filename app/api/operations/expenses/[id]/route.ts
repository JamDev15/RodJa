import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { attachExpenseReceipt, markExpensePaid, voidExpense } from "@/lib/finance/expenses";
import { formFile, isMultipart } from "@/lib/operations/http";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/expenses/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if (isMultipart(req)) return attachExpenseReceipt(actor, id, formFile(await req.formData(), "file"));
    const { action, ...body } = await jsonBody(req);
    if (action === "void") return voidExpense(actor, id, body.reason);
    if (action === "mark_paid") return markExpensePaid(actor, id, body);
    throw invalid("Unknown action");
  });
}
