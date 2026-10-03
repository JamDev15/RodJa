import { prisma } from "@/lib/prisma";
import { subscriptionPdf, type SubscriptionDocType } from "@/lib/subscription-docs";

/** Shared GET handler body for owner and admin subscription PDF downloads. */
export async function subscriptionPdfResponse(req: Request, recordId: string, accountId?: string): Promise<Response> {
  const type = (new URL(req.url).searchParams.get("type") ?? "invoice") as SubscriptionDocType;
  if (type !== "invoice" && type !== "receipt") return new Response("Bad type", { status: 400 });

  const record = await prisma.billingRecord.findFirst({
    where: { id: recordId, ...(accountId ? { accountId } : {}) },
    include: { account: { include: { plan: true } } },
  });
  if (!record) return new Response("Not found", { status: 404 });
  if (type === "receipt" && record.status !== "paid") return new Response("Receipt is available once the payment is approved", { status: 409 });

  const { buffer, filename } = await subscriptionPdf(record, type);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
