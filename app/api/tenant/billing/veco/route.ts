import { handle } from "@/lib/collections/http";
import { submitVecoReceipt } from "@/lib/collections/veco";

/** Tenant: upload a VECO electricity receipt for a billing month (multipart form). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await req.formData();
    const get = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
    const file = form.get("receipt");
    return submitVecoReceipt(actor, { billingMonth: get("billingMonth"), amount: get("amount") || null, paidOn: get("paidOn") || null }, file instanceof File ? file : null);
  }, 201);
}
