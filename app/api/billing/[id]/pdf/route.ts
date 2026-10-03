import { currentAccountId } from "@/lib/owner-auth";
import { subscriptionPdfResponse } from "@/lib/subscription-pdf-response";

/** Owner downloads the invoice (?type=invoice) or receipt (?type=receipt) for their own subscription bill. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) return new Response("Unauthorized", { status: 401 });
  return subscriptionPdfResponse(req, id, accountId);
}
