import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { parseReportName, runReport, toCsv } from "@/lib/finance/reports";

/** A report as JSON, or as CSV with ?format=csv. Office only (proxy + service). */
export async function GET(req: Request, ctx: RouteContext<"/api/operations/reports/[name]">) {
  const { name } = await ctx.params;
  const q = new URL(req.url).searchParams;
  try {
    const report = parseReportName(name);
    const actor = await currentActor();
    const table = await runReport(actor!, report, { propertyId: q.get("propertyId"), from: q.get("from"), to: q.get("to"), asOf: q.get("asOf") });
    if (q.get("format") !== "csv") return NextResponse.json(table, { headers: { "Cache-Control": "private, no-store" } });
    const range = q.get("from") && q.get("to") ? `${q.get("from")}_to_${q.get("to")}` : (q.get("asOf") ?? "today");
    const fileName = `${report}-${range}.csv`.replace(/[^\w.\-]/g, "_");
    return new Response(toCsv(table), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof BillingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Report failed:", err);
    return NextResponse.json({ error: "Could not build the report" }, { status: 500 });
  }
}
