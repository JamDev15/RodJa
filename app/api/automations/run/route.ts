import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runAutomationSweep } from "@/lib/automations";

/**
 * "Run now": evaluates today's matches for this account's automations right
 * away instead of waiting for the daily cron. Safe to press repeatedly —
 * each tenant/period is only ever sent once.
 */
export async function POST() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runAutomationSweep(new Date(), accountId);
  return NextResponse.json(result);
}
