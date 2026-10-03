import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/owner-auth";
import { runOwnerWorkflowSweep } from "@/lib/owner-workflows";

/** "Run today's now" — starts/advances this owner's workflows without waiting for the daily run. */
export async function POST() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runOwnerWorkflowSweep(new Date(), accountId));
}
