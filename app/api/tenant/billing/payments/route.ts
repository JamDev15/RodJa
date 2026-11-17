import { handle } from "@/lib/collections/http";
import { parsePesos } from "@/lib/collections/money";
import { submitTenantPayment } from "@/lib/collections/payments";
import { paymentSubmitted } from "@/lib/messenger/events";

/** Tenant: submit proof of a full or partial payment (multipart form). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await req.formData();
    const get = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
    const proof = form.get("proof");
    const result = await submitTenantPayment(
      actor,
      {
        amountCentavos: parsePesos(get("amount")) ?? NaN,
        method: get("method") as never,
        paidOn: get("paidOn"),
        referenceNumber: get("referenceNumber") || null,
        notes: get("notes") || null,
        clientRequestId: get("clientRequestId") || null,
      },
      proof instanceof File ? proof : null,
    );
    if (!result.duplicate) await paymentSubmitted(result.payment.id).catch(() => undefined);
    return result;
  }, 201);
}
