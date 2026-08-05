import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";
import { runBillingSweep } from "@/lib/billing";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sequential, not parallel — the Supabase pooler here has a low
  // concurrent-connection cap, and both sweeps touch the DB heavily.
  const reminders = await runReminderSweep();
  const billing = await runBillingSweep();
  return NextResponse.json({ reminders, billing });
}
