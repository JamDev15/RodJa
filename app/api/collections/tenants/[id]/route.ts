import { sendReceiptEmail } from "@/lib/collections/documents";
import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody, num, str } from "@/lib/collections/http";
import { recordAdminPayment } from "@/lib/collections/payments";
import { recordOpeningBalance, updateTenantBilling } from "@/lib/collections/rooms";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/tenants/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    switch (action) {
      case "billing":
        return updateTenantBilling(actor, id, body as never);
      case "opening_balance":
        return recordOpeningBalance(actor, id, { amountCentavos: num(body.amountCentavos), asOfDate: str(body.asOfDate), description: str(body.description) });
      case "record_payment":
      {
        const result = await recordAdminPayment(actor, id, body as never);
        const receiptEmail = result.duplicate ? null : await sendReceiptEmail(result.payment.id).catch(() => ({ sent: false, reason: "Email failed" }));
        return { ...result, receiptEmail };
      }
      default:
        throw invalid("Unknown action");
    }
  });
}
