import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { attachBillFile, payUtilityBill, updateUtilityBill, voidUtilityBill } from "@/lib/finance/utilities";
import { formFile, isMultipart } from "@/lib/operations/http";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/utility-bills/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if (isMultipart(req)) return attachBillFile(actor, id, formFile(await req.formData(), "file"));
    const { action, ...body } = await jsonBody(req);
    if (action === "pay") return payUtilityBill(actor, id, body);
    if (action === "update") return updateUtilityBill(actor, id, body);
    if (action === "void") return voidUtilityBill(actor, id, body.reason);
    throw invalid("Unknown action");
  });
}
