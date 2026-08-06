import { prisma } from "@/lib/prisma";
import { sendBillingReminder, sendAccountPaused, sendTrialEndingSoon, sendTrialEnded } from "@/lib/email";
import { daysBetween } from "@/lib/due-dates";

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
      const diff = daysBetween(now, latest.dueDate);

      if (diff === 3 && !latest.reminderSentAt) {
        const sent = await sendBillingReminder(account.email, account.ownerName, latest.amount, latest.dueDate, latest.period);
        if (sent) {
          await prisma.billingRecord.update({ where: { id: latest.id }, data: { reminderSentAt: now } });
          remindersSent++;
        }
      }

      if (now >= latest.dueDate) {
        await prisma.billingRecord.update({ where: { id: latest.id }, data: { status: "overdue" } });
        await prisma.account.update({ where: { id: account.id }, data: { isActive: false } });
        await sendAccountPaused(account.email, account.ownerName, latest.period);
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
 * Free plan has no billing cycle — it's a 7-day trial only (Account.trialEndsAt,
 * set at signup). Sends a reminder 3 days before it ends, and auto-pauses the
 * account once it does, the same way an unpaid subscription pauses.
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

    if (diff === 3 && !account.trialReminderSentAt) {
      const sent = await sendTrialEndingSoon(account.email, account.ownerName, account.trialEndsAt);
      if (sent) {
        await prisma.account.update({ where: { id: account.id }, data: { trialReminderSentAt: now } });
        remindersSent++;
      }
    }

    if (now >= account.trialEndsAt) {
      await prisma.account.update({ where: { id: account.id }, data: { isActive: false } });
      await sendTrialEnded(account.email, account.ownerName);
      accountsPaused++;
    }
  }

  return { remindersSent, accountsPaused };
}
