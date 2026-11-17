import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { pdfResponse, receiptPdf } from "@/lib/collections/documents";
import { BillingError } from "@/lib/collections/errors";

/** Receipt for an approved payment — the account's admins or the tenant who paid. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/receipts/[id]">) {
  const { id } = await ctx.params;
  try {
    const { bytes, fileName } = await receiptPdf(await currentActor(), id);
    return pdfResponse(bytes, fileName, new URL(req.url).searchParams.has("download"));
  } catch (err) {
    if (err instanceof BillingError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("Receipt PDF failed:", err);
    return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
  }
}
