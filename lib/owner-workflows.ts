import { prisma } from "@/lib/prisma";
import type { Account, OwnerWorkflow } from "@prisma/client";
import { sendAutomationEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { sendPushToAccount } from "@/lib/push";
import { logMessage, type LogContext } from "@/lib/message-log";
import { dueDateForMonth, monthKeyOf, toPhDateOnly } from "@/lib/due-dates";
import {
  amountDueFor,
  fillTemplate,
  leaseEndOf,
  matchAutomation,
  tenantInclude,
  varsFor,
  type TenantFull,
} from "@/lib/automations";
import { invoiceItemsFromLedger, issueDocument } from "@/lib/invoices";
import { OWNER_WORKFLOW_TRIGGERS, type OwnerWorkflowStep, type OwnerWorkflowTrigger } from "@/lib/owner-workflow-meta";

export * from "@/lib/owner-workflow-meta";

function stepsOf(w: Pick<OwnerWorkflow, "steps">): OwnerWorkflowStep[] {
  return Array.isArray(w.steps) ? (w.steps as unknown as OwnerWorkflowStep[]) : [];
}

function isBillBased(trigger: string): boolean {
  return OWNER_WORKFLOW_TRIGGERS.find((t) => t.value === trigger)?.billBased ?? false;
}

/** Tenant with the ledger/payments for the enrollment's own bill month (which may be older than "now"). */
async function loadTenant(tenantId: string, monthKey: string): Promise<TenantFull | null> {
  return (await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: { include: { property: true } },
      ledger: { where: { month: monthKey } },
      payments: { where: { month: monthKey } },
      contracts: { where: { status: "signed" }, select: { endDate: true } },
    },
  })) as TenantFull | null;
}

/**
 * Runs an enrollment forward until a wait (which schedules the next run),
 * the end, or an exit. The step position is saved after each step so a
 * crash or timeout never repeats a message.
 */
export async function processOwnerEnrollment(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.ownerWorkflowEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { workflow: { include: { account: true } } },
  });
  if (!enrollment || enrollment.status !== "active") return;
  const { workflow } = enrollment;
  const account: Account = workflow.account;
  if (!workflow.isActive || !account.isActive) return;

  const steps = stepsOf(workflow);
  let i = enrollment.stepIndex;
  const exit = (reason: string, status: "exited" | "completed" = "exited") =>
    prisma.ownerWorkflowEnrollment.update({ where: { id: enrollment.id }, data: { status, exitReason: reason, completedAt: new Date() } });

  while (i < steps.length) {
    const now = new Date();
    const tenant = await loadTenant(enrollment.tenantId, enrollment.monthKey);
    if (!tenant || !tenant.isActive) {
      await exit("Tenant is no longer active");
      return;
    }

    const billBased = isBillBased(workflow.trigger);
    const owes = amountDueFor(tenant, enrollment.monthKey);
    if (workflow.stopWhenPaid && billBased && owes <= 0) {
      await exit("Bill paid");
      return;
    }

    const step = steps[i];
    const match = {
      periodKey: enrollment.periodKey,
      monthKey: enrollment.monthKey,
      dueDate: dueDateForMonth(enrollment.monthKey, tenant.dueDay),
      leaseEnd: leaseEndOf(tenant),
    };
    const vars = varsFor(account, tenant, { offsetDays: workflow.offsetDays }, match);
    const tenantLog: LogContext = { accountId: account.id, tenantId: tenant.id, recipientType: "tenant", recipientName: tenant.name, category: "workflow" };
    const ownerLog: LogContext = { ...tenantLog, recipientType: "owner", recipientName: account.ownerName };
    let error: string | null = null;

    if (step.type === "wait") {
      // Snap to the start of the target day (PH) so the daily cron picks it up that day.
      const next = toPhDateOnly(new Date(now.getTime() + Math.max(0, step.days) * 86400000));
      await prisma.ownerWorkflowEnrollment.update({ where: { id: enrollment.id }, data: { stepIndex: i + 1, nextRunAt: next, lastError: null } });
      if (step.days > 0) return;
      i++;
      continue;
    }

    if (step.type === "email") {
      if (tenant.email) {
        const ok = await sendAutomationEmail(tenant.email, fillTemplate(step.subject, vars), fillTemplate(step.body, vars), account.ownerName, tenantLog);
        if (!ok) error = "Email failed to send";
      } else {
        error = "Tenant has no email — skipped";
      }
    } else if (step.type === "sms") {
      const ok = await sendSMS(tenant.phone, fillTemplate(step.body, vars).slice(0, 450), tenantLog);
      if (!ok) error = "SMS failed to send";
    } else if (step.type === "portal") {
      const title = fillTemplate(step.title, vars);
      const body = fillTemplate(step.body, vars);
      await prisma.notice.create({ data: { tenantId: tenant.id, accountId: account.id, title, content: body, type: "reminder" } });
      await logMessage({ ...tenantLog, channel: "in_app", to: "Tenant portal", subject: title, body, status: "sent" });
    } else if (step.type === "send_invoice") {
      const ledger = tenant.ledger.find((l) => l.month === enrollment.monthKey);
      const items = ledger ? invoiceItemsFromLedger(ledger) : [];
      if (ledger && items.length > 0) {
        await issueDocument({ account, tenant, type: "invoice", items, month: enrollment.monthKey, ledgerId: ledger.id });
      } else {
        error = "No unpaid bills recorded for this month — invoice skipped";
      }
    } else if (step.type === "notify_owner") {
      const subject = fillTemplate(step.subject, vars);
      const body = fillTemplate(step.body, vars);
      await sendAutomationEmail(account.email, subject, body, "TenantHub", ownerLog);
      await sendPushToAccount(account.id, { title: subject, body: body.slice(0, 180), url: `/dashboard/tenants/${tenant.id}` }, ownerLog);
    }

    i++;
    await prisma.ownerWorkflowEnrollment.update({ where: { id: enrollment.id }, data: { stepIndex: i, lastError: error } });
  }

  await exit("Finished all steps", "completed");
}

/** Starts a workflow for one tenant/period. Returns false if that period already ran. */
export async function enrollTenant(workflowId: string, tenantId: string, periodKey: string, monthKey: string): Promise<boolean> {
  let id: string;
  try {
    const e = await prisma.ownerWorkflowEnrollment.create({ data: { workflowId, tenantId, periodKey, monthKey } });
    id = e.id;
  } catch {
    return false; // unique (workflow, tenant, period) — already started
  }
  try {
    await processOwnerEnrollment(id);
  } catch (err) {
    console.error("Owner workflow step failed:", err);
    await prisma.ownerWorkflowEnrollment.update({ where: { id }, data: { lastError: String(err).slice(0, 300) } }).catch(() => {});
  }
  return true;
}

/** Event hook (e.g. tenant added). Never throws. */
export async function triggerOwnerWorkflows(accountId: string, tenantId: string, trigger: OwnerWorkflowTrigger): Promise<void> {
  try {
    const workflows = await prisma.ownerWorkflow.findMany({ where: { accountId, isActive: true, trigger } });
    const monthKey = monthKeyOf(new Date());
    for (const w of workflows) await enrollTenant(w.id, tenantId, trigger === "tenant_added" ? "added" : `event:${Date.now()}`, monthKey);
  } catch (err) {
    console.error("triggerOwnerWorkflows failed:", err);
  }
}

export interface OwnerWorkflowSweepResult {
  started: number;
  advanced: number;
  errors: number;
}

/**
 * Daily: (1) starts date-based workflows for every tenant whose day it is,
 * (2) advances enrollments whose wait has elapsed. Optional accountId limits
 * it to one owner (the "Run now" button).
 */
export async function runOwnerWorkflowSweep(now: Date = new Date(), onlyAccountId?: string): Promise<OwnerWorkflowSweepResult> {
  const result: OwnerWorkflowSweepResult = { started: 0, advanced: 0, errors: 0 };

  const workflows = await prisma.ownerWorkflow.findMany({
    where: {
      isActive: true,
      account: { isActive: true },
      trigger: { in: ["before_due", "on_due", "after_due", "day_of_month", "lease_end"] },
      ...(onlyAccountId ? { accountId: onlyAccountId } : {}),
    },
  });

  const tenantsByAccount = new Map<string, TenantFull[]>();
  for (const w of workflows) {
    if (!tenantsByAccount.has(w.accountId)) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true, unit: { property: { accountId: w.accountId } } },
        include: tenantInclude(now),
      });
      tenantsByAccount.set(w.accountId, tenants as TenantFull[]);
    }
    for (const tenant of tenantsByAccount.get(w.accountId)!) {
      const match = matchAutomation({ trigger: w.trigger, offsetDays: w.offsetDays }, tenant, now);
      if (!match) continue;
      // Overdue sequences only start for tenants who actually owe.
      if (w.trigger === "after_due" && amountDueFor(tenant, match.monthKey) <= 0) continue;
      try {
        if (await enrollTenant(w.id, tenant.id, match.periodKey, match.monthKey)) result.started++;
      } catch (err) {
        result.errors++;
        console.error("Owner workflow start failed:", err);
      }
    }
  }

  const due = await prisma.ownerWorkflowEnrollment.findMany({
    where: {
      status: "active",
      nextRunAt: { lte: now },
      workflow: { isActive: true, ...(onlyAccountId ? { accountId: onlyAccountId } : {}) },
    },
    select: { id: true },
    orderBy: { nextRunAt: "asc" },
    take: 1000,
  });
  for (const { id } of due) {
    try {
      await processOwnerEnrollment(id);
      result.advanced++;
    } catch (err) {
      result.errors++;
      console.error("Owner workflow enrollment failed:", err);
      await prisma.ownerWorkflowEnrollment.update({ where: { id }, data: { lastError: String(err).slice(0, 300) } }).catch(() => {});
    }
  }
  return result;
}
