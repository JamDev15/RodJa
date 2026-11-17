import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody, num, optStr, str } from "@/lib/collections/http";
import { approvePayment, rejectPayment, reversePayment } from "@/lib/collections/payments";
import { sendReceiptEmail } from "@/lib/collections/documents";

export async function POST(req: Request, ctx: RouteContext<"/api/collections/payments/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const body = await jsonBody(req);
    switch (body.action) {
      case "approve": {
        const corrected = body.correctedAmountCentavos == null || body.correctedAmountCentavos === "" ? undefined : num(body.correctedAmountCentavos);
        const result = await approvePayment(actor, id, { correctedAmountCentavos: corrected, note: optStr(body.note) ?? undefined });
        // Best effort, at most once: a failed email never undoes the approval.
        const receiptEmail = result.alreadyApproved ? null : await sendReceiptEmail(id).catch(() => ({ sent: false, reason: "Email failed" }));
        return { ...result, receiptEmail };
      }
      case "reject":
        return rejectPayment(actor, id, str(body.reason));
      case "reverse":
        return reversePayment(actor, id, str(body.reason));
      default:
        throw invalid("Unknown action");
    }
  });
}
