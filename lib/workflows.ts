import { prisma } from "@/lib/prisma";
import type { Account, Workflow, WorkflowEnrollment } from "@prisma/client";
import { APP_URL, sendAdminWorkflowNotice, sendWorkflowEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { renewUrlFor, unsubscribeUrlFor } from "@/lib/tokens";
import { toPhDateOnly } from "@/lib/due-dates";
import type { WorkflowStep, WorkflowTrigger } from "@/lib/workflow-meta";

export * from "@/lib/workflow-meta";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

function leadVars(a: Account): Record<string, string> {
  return {
    name: a.ownerName,
    first_name: a.ownerName.split(/\s+/)[0] ?? a.ownerName,
    business: a.name,
    email: a.email,
    phone: a.phone ?? "",
    social: a.socialMedia ?? "",
    trial_ends: a.trialEndsAt
      ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" }).format(a.trialEndsAt)
      : "",
    renew_link: renewUrlFor(a.id),
    login_link: `${APP_URL}/login`,
  };
}

function stepsOf(w: Pick<Workflow, "steps">): WorkflowStep[] {
  return Array.isArray(w.steps) ? (w.steps as unknown as WorkflowStep[]) : [];
}

async function isConverted(account: Account): Promise<boolean> {
  if (account.leadStatus === "converted" || account.lifetimeAccess) return true;
  const paid = await prisma.billingRecord.findFirst({ where: { accountId: account.id, status: "paid" }, select: { id: true } });
  return !!paid;
}

async function getAdminRecipients(): Promise<string[]> {
  const settings = await prisma.platformSettings.findFirst();
  if (settings?.notificationEmail) return [settings.notificationEmail];
  const admins = await prisma.superAdmin.findMany({ select: { email: true } });
  return admins.map((a) => a.email);
}

/**
 * Runs one enrollment forward from its current step until it hits a wait
 * (which schedules the next run), reaches the end, or exits. Each step's
 * position is saved before the next starts, so a crash never repeats a send.
 */
export async function processEnrollment(enrollmentId: string, depth = 0): Promise<void> {
  const enrollment = await prisma.workflowEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { workflow: true, account: true },
  });
  if (!enrollment || enrollment.status !== "active") return;

  const { workflow } = enrollment;
  let account = enrollment.account;
  const steps = stepsOf(workflow);
  let i = enrollment.stepIndex;

  if (!workflow.isActive) return; // paused workflows hold their place

  while (i < steps.length) {
    if (workflow.stopOnConversion && (await isConverted(account))) {
      await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "exited", exitReason: "Became a paying customer", completedAt: new Date() } });
      return;
    }

    const step = steps[i];
    const vars = leadVars(account);
    const log = { accountId: account.id, recipientType: "lead" as const, recipientName: account.ownerName, category: "workflow" as const };
    let error: string | null = null;

    if (step.type === "wait") {
      // Snap to the start of the target day (PH) so the once-a-day cron picks
      // it up on that day instead of drifting a day late.
      const next = toPhDateOnly(new Date(Date.now() + Math.max(0, step.days) * 86400000));
      await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { stepIndex: i + 1, nextRunAt: next, lastError: null } });
      if (step.days > 0) return;
      i++;
      continue;
    }

    if (step.type === "email") {
      if (!account.marketingOptOut) {
        const ok = await sendWorkflowEmail({
          to: account.email,
          subject: fill(step.subject, vars),
          body: fill(step.body, vars),
          unsubscribeUrl: unsubscribeUrlFor(account.id),
          log,
        });
        if (!ok) error = "Email failed to send";
      }
    } else if (step.type === "sms") {
      if (!account.marketingOptOut && account.phone) {
        const ok = await sendSMS(account.phone, fill(step.body, vars).slice(0, 450), log);
        if (!ok) error = "SMS failed to send";
      }
    } else if (step.type === "set_status") {
      if (account.leadStatus !== step.status) {
        account = await prisma.account.update({ where: { id: account.id }, data: { leadStatus: step.status } });
        await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { stepIndex: i + 1 } });
        // A status change can start other workflows (bounded to avoid loops).
        if (depth < 3) await triggerWorkflows(account.id, "lead_status", step.status, depth + 1, workflow.id);
      }
    } else if (step.type === "notify_admin") {
      const recipients = await getAdminRecipients();
      await Promise.all(recipients.map((to) => sendAdminWorkflowNotice(to, fill(step.subject, vars), fill(step.body, vars), account.id)));
    }

    i++;
    await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { stepIndex: i, lastError: error } });
  }

  await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { status: "completed", completedAt: new Date() } });
}

/** (Re-)enrolls an account and immediately runs its first steps. Already-active enrollments are left alone. */
export async function enroll(workflowId: string, accountId: string, depth = 0): Promise<WorkflowEnrollment | null> {
  const existing = await prisma.workflowEnrollment.findUnique({ where: { workflowId_accountId: { workflowId, accountId } } });
  if (existing?.status === "active") return null;

  const enrollment = existing
    ? await prisma.workflowEnrollment.update({
        where: { id: existing.id },
        data: { status: "active", stepIndex: 0, nextRunAt: new Date(), lastError: null, exitReason: null, completedAt: null, enrolledAt: new Date() },
      })
    : await prisma.workflowEnrollment.create({ data: { workflowId, accountId } });

  try {
    await processEnrollment(enrollment.id, depth);
  } catch (err) {
    console.error("Workflow step failed:", err);
    await prisma.workflowEnrollment.update({ where: { id: enrollment.id }, data: { lastError: String(err).slice(0, 300) } }).catch(() => {});
  }
  return enrollment;
}

/**
 * Event hook: enrolls the account in every active workflow listening for this
 * trigger. Never throws — a workflow problem must not break signup, billing, etc.
 */
export async function triggerWorkflows(
  accountId: string,
  trigger: WorkflowTrigger,
  value?: string,
  depth = 0,
  skipWorkflowId?: string
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        isActive: true,
        trigger,
        ...(trigger === "lead_status" ? { triggerValue: value } : {}),
        ...(skipWorkflowId ? { id: { not: skipWorkflowId } } : {}),
      },
    });
    for (const w of workflows) await enroll(w.id, accountId, depth);
  } catch (err) {
    console.error(`triggerWorkflows(${trigger}) failed:`, err);
  }
}

/** Called when an account pays: stops every "stop on conversion" workflow for them. */
export async function exitWorkflowsOnConversion(accountId: string): Promise<void> {
  try {
    await prisma.workflowEnrollment.updateMany({
      where: { accountId, status: "active", workflow: { stopOnConversion: true } },
      data: { status: "exited", exitReason: "Became a paying customer", completedAt: new Date() },
    });
  } catch (err) {
    console.error("exitWorkflowsOnConversion failed:", err);
  }
}

export interface WorkflowSweepResult {
  processed: number;
  errors: number;
}

/** Daily cron: advances every enrollment whose wait has elapsed. */
export async function runWorkflowSweep(now: Date = new Date()): Promise<WorkflowSweepResult> {
  const due = await prisma.workflowEnrollment.findMany({
    where: { status: "active", nextRunAt: { lte: now }, workflow: { isActive: true } },
    select: { id: true },
    orderBy: { nextRunAt: "asc" },
    take: 500,
  });
  let processed = 0;
  let errors = 0;
  for (const { id } of due) {
    try {
      await processEnrollment(id);
      processed++;
    } catch (err) {
      errors++;
      console.error("Workflow enrollment failed:", err);
      await prisma.workflowEnrollment.update({ where: { id }, data: { lastError: String(err).slice(0, 300) } }).catch(() => {});
    }
  }
  return { processed, errors };
}
