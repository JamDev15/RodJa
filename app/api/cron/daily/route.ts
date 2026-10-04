import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/reminders";
import { runBillingSweep, runFreeTrialSweep } from "@/lib/billing";
import { runBillReminderSweep } from "@/lib/bill-reminders";
import { runMonthlyReportSweep } from "@/lib/monthly-report";
import { runAutomationSweep } from "@/lib/automations";
import { runWorkflowSweep } from "@/lib/workflows";
import { runOwnerWorkflowSweep } from "@/lib/owner-workflows";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sequential, not parallel — the Supabase pooler here has a low
  // concurrent-connection cap, and all sweeps touch the DB heavily. Each one
  // is isolated so a failure in one doesn't skip the rest.
  const run = async <T,>(name: string, fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch (err) {
      console.error(`Cron sweep "${name}" failed:`, err);
      return { error: String(err) };
    }
  };

  const reminders = await run("reminders", () => runReminderSweep());
  const billReminders = await run("billReminders", () => runBillReminderSweep());
  const automations = await run("automations", () => runAutomationSweep());
  const ownerWorkflows = await run("ownerWorkflows", () => runOwnerWorkflowSweep());
  const billing = await run("billing", () => runBillingSweep());
  const freeTrials = await run("freeTrials", () => runFreeTrialSweep());
  const workflows = await run("workflows", () => runWorkflowSweep());
  const monthlyReports = await run("monthlyReports", () => runMonthlyReportSweep());
  return NextResponse.json({ reminders, billReminders, automations, ownerWorkflows, billing, freeTrials, workflows, monthlyReports });
}
