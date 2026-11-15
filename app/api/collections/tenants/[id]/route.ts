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
        return recordAdminPayment(actor, id, body as never);
      default:
        throw invalid("Unknown action");
    }
  });
}
