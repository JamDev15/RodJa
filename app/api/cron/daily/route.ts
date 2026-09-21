import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";
import { runBillingSweep, runFreeTrialSweep } from "@/lib/billing";
import { runBillReminderSweep } from "@/lib/bill-reminders";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sequential, not parallel — the Supabase pooler here has a low
  // concurrent-connection cap, and all sweeps touch the DB heavily.
  const reminders = await runReminderSweep();
  const billReminders = await runBillReminderSweep();
  const billing = await runBillingSweep();
  const freeTrials = await runFreeTrialSweep();
  return NextResponse.json({ reminders, billReminders, billing, freeTrials });
}
