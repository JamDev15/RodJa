import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { pdfResponse, statementPdf } from "@/lib/collections/documents";
import { BillingError } from "@/lib/collections/errors";

/** Issued statement as a PDF — the account's admins or the tenant it belongs to. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/statements/[id]">) {
  const { id } = await ctx.params;
  try {
    const { bytes, fileName } = await statementPdf(await currentActor(), id);
    return pdfResponse(bytes, fileName, new URL(req.url).searchParams.has("download"));
  } catch (err) {
    if (err instanceof BillingError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("Statement PDF failed:", err);
    return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
  }
}
