import { prisma } from "@/lib/prisma";
import type { Account } from "@prisma/client";
import { sendBillingReminder, sendAccountPaused, sendTrialEndingSoon, sendTrialEnded, sendAdminTrialAlert, type SignupDetails } from "@/lib/email";
import { daysBetween } from "@/lib/due-dates";
import { renewUrlFor } from "@/lib/tokens";
import { triggerWorkflows } from "@/lib/workflows";
import type { LogContext } from "@/lib/message-log";

const ownerLog = (account: Pick<Account, "id" | "ownerName">, category: "billing" | "trial"): LogContext => ({
  accountId: account.id,
  recipientType: "owner",
  recipientName: account.ownerName,
  category,
});

export function signupDetailsOf(account: Account): SignupDetails {
  return {
    accountId: account.id,
    businessName: account.name,
    ownerName: account.ownerName,
    email: account.email,
    phone: account.phone,
    socialMedia: account.socialMedia,
    wantsOnboardingCall: account.wantsOnboardingCall,
    trialEndsAt: account.trialEndsAt,
  };
}

/** "Expires tomorrow": owner gets a subscribe nudge, platform admin gets a heads-up, workflows fire. */
async function trialExpiringSoon(account: Account, trialEndsAt: Date, now: Date): Promise<boolean> {
  let sent = false;
  if (!account.trialReminderSentAt) {
    sent = await sendTrialEndingSoon(account.email, account.ownerName, trialEndsAt, renewUrlFor(account.id), ownerLog(account, "trial"));
    if (sent) await prisma.account.update({ where: { id: account.id }, data: { trialReminderSentAt: now } });
  }
  if (!account.trialAdminAlertSentAt) {
    const recipients = await getNotificationRecipients();
    await Promise.all(recipients.map((to) => sendAdminTrialAlert(to, signupDetailsOf(account), "expiring")));
    await prisma.account.update({ where: { id: account.id }, data: { trialAdminAlertSentAt: now } });
    await triggerWorkflows(account.id, "trial_ending");
  }
  return sent;
}

/** Trial over without paying: pause, tell the owner how to reactivate, alert the admin, fire workflows. */
async function trialExpired(account: Account): Promise<void> {
  await prisma.account.update({ where: { id: account.id }, data: { isActive: false } });
  await sendTrialEnded(account.email, account.ownerName, renewUrlFor(account.id), ownerLog(account, "trial"));
  const recipients = await getNotificationRecipients();
  await Promise.all(recipients.map((to) => sendAdminTrialAlert(to, signupDetailsOf(account), "expired")));
  await triggerWorkflows(account.id, "trial_expired");
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function periodLabelFor(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(date);
}

/**
 * Who gets "new payment submitted" notifications: the configured
 * PlatformSettings.notificationEmail if set (a real inbox, independent of
 * login credentials), otherwise every SuperAdmin's login email as a fallback.
 */
export async function getNotificationRecipients(): Promise<string[]> {
  const settings = await prisma.platformSettings.findFirst();
  if (settings?.notificationEmail) return [settings.notificationEmail];

  const admins = await prisma.superAdmin.findMany({ select: { email: true } });
  return admins.map((a) => a.email);
}

export interface BillingSweepResult {
  cyclesCreated: number;
  remindersSent: number;
  accountsPaused: number;
}

/**
 * Recurring subscription billing for paid-plan accounts:
 * - Creates the next billing cycle's record once the previous one is paid
 *   and its due date has arrived (or immediately, for an account's first
 *   cycle, anchored to the end of its free trial).
 * - Sends a reminder email 3 days before a pending/submitted record's due date.
 * - Auto-pauses (isActive = false) any account whose bill is still unpaid
 *   once the due date arrives, the same way the admin "Suspend" toggle does.
 */
export async function runBillingSweep(now: Date = new Date()): Promise<BillingSweepResult> {
  let cyclesCreated = 0;
  let remindersSent = 0;
  let accountsPaused = 0;

  const accounts = await prisma.account.findMany({
    where: { isActive: true, lifetimeAccess: false, plan: { price: { gt: 0 } } },
    include: { plan: true },
  });

  for (const account of accounts) {
    const latest = await prisma.billingRecord.findFirst({
      where: { accountId: account.id },
      orderBy: { dueDate: "desc" },
    });

    if (!latest) {
      const dueDate = account.trialEndsAt ?? account.createdAt;
      await prisma.billingRecord.create({
        data: {
          accountId: account.id,
          amount: account.plan.price,
          period: periodLabelFor(dueDate),
          dueDate,
          status: "pending",
        },
      });
      cyclesCreated++;
      continue;
    }

    if (latest.status === "paid") {
      if (now >= latest.dueDate) {
        const nextDueDate = addMonths(latest.dueDate, 1);
        await prisma.billingRecord.create({
          data: {
            accountId: account.id,
            amount: account.plan.price,
            period: periodLabelFor(nextDueDate),
            dueDate: nextDueDate,
            status: "pending",
          },
        });
        cyclesCreated++;
      }
      continue;
    }

    if (latest.status === "pending" || latest.status === "submitted") {
      // diff < 0 means the due date is still ahead (daysBetween = now - due).
      const diff = daysBetween(now, latest.dueDate);
      // Still on the free trial: this first bill's due date *is* the trial end.
      const inTrial = !!account.trialEndsAt && !(await prisma.billingRecord.findFirst({ where: { accountId: account.id, status: "paid" }, select: { id: true } }));

      if (inTrial) {
        if (diff === -1 && (await trialExpiringSoon(account, latest.dueDate, now))) remindersSent++;
        // A payment submitted for review keeps the account open until the admin decides.
        if (now >= latest.dueDate && latest.status !== "submitted") {
          await prisma.billingRecord.update({ where: { id: latest.id }, data: { status: "overdue" } });
          await trialExpired(account);
          accountsPaused++;
        }
        continue;
      }

      if (diff === -3 && !latest.reminderSentAt) {
        const sent = await sendBillingReminder(account.email, account.ownerName, latest.amount, latest.dueDate, latest.period, ownerLog(account, "billing"));
        if (sent) {
          await prisma.billingRecord.update({ where: { id: latest.id }, data: { reminderSentAt: now } });
          remindersSent++;
        }
      }

      if (now >= latest.dueDate) {
        await prisma.billingRecord.update({ where: { id: latest.id }, data: { status: "overdue" } });
        await prisma.account.update({ where: { id: account.id }, data: { isActive: false } });
        await sendAccountPaused(account.email, account.ownerName, latest.period, renewUrlFor(account.id), ownerLog(account, "billing"));
        accountsPaused++;
      }
    }
  }

  return { cyclesCreated, remindersSent, accountsPaused };
}

export interface FreeTrialSweepResult {
  remindersSent: number;
  accountsPaused: number;
}

/**
 * Legacy Free-plan accounts (signed up before the single ₱499 plan): no
 * billing cycle, just Account.trialEndsAt. Same treatment as a new trial —
 * a nudge the day before, then pause with a reactivation link.
 */
export async function runFreeTrialSweep(now: Date = new Date()): Promise<FreeTrialSweepResult> {
  let remindersSent = 0;
  let accountsPaused = 0;

  const accounts = await prisma.account.findMany({
    where: { isActive: true, lifetimeAccess: false, plan: { price: 0 }, trialEndsAt: { not: null } },
  });

  for (const account of accounts) {
    if (!account.trialEndsAt) continue;
    const diff = daysBetween(now, account.trialEndsAt);

    if (diff === -1 && (await trialExpiringSoon(account, account.trialEndsAt, now))) remindersSent++;

    if (now >= account.trialEndsAt) {
      await trialExpired(account);
      accountsPaused++;
    }
  }

  return { remindersSent, accountsPaused };
}
