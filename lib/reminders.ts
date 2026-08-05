import { prisma } from "@/lib/prisma";
import { sendPaymentReminder } from "@/lib/email";
import { sendSMS, buildReminderMessage } from "@/lib/sms";
import { daysBetween, monthKeyOf, shiftMonthKey, defaultDueDateFor, toPhDateOnly } from "@/lib/due-dates";

function computeTrigger(diff: number, daysBefore: number[], daysAfter: number[]): string | null {
  if (diff === 0) return "due_date";
  if (diff < 0 && daysBefore.includes(-diff)) return `${-diff}days_before`;
  if (diff > 0 && daysAfter.includes(diff)) return `${diff}days_after`;
  return null;
}

export interface ReminderSweepResult {
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Finds tenants due/overdue on rent per each account's ReminderConfig
 * schedule, sends via whichever channels are enabled, and records a
 * Reminder row per tenant per trigger per day so nobody gets double-sent.
 */
export async function runReminderSweep(now: Date = new Date()): Promise<ReminderSweepResult> {
  const thisMonth = monthKeyOf(now);
  const monthKeys = [shiftMonthKey(thisMonth, -1), thisMonth, shiftMonthKey(thisMonth, 1)];
  const todayStart = toPhDateOnly(now);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const configs = await prisma.reminderConfig.findMany({
    where: { OR: [{ smsEnabled: true }, { emailEnabled: true }, { inAppEnabled: true }] },
  });

  for (const config of configs) {
    const account = await prisma.account.findUnique({ where: { id: config.accountId } });
    if (!account || !account.isActive) continue;

    const tenants = await prisma.tenant.findMany({
      where: { isActive: true, unit: { property: { accountId: config.accountId } } },
      include: { unit: true, payments: { where: { month: { in: monthKeys } } } },
    });

    const daysBefore = Array.isArray(config.daysBefore) ? (config.daysBefore as number[]) : [7, 3, 1];
    const daysAfter = Array.isArray(config.daysAfter) ? (config.daysAfter as number[]) : [1, 3, 7];

    for (const tenant of tenants) {
      let firedForTenant = false;

      for (const monthKey of monthKeys) {
        if (firedForTenant) break;

        const payment = tenant.payments.find((p) => p.month === monthKey);
        if (payment?.status === "approved") continue;

        const dueDate = payment?.dueDate ?? defaultDueDateFor(monthKey);
        const diff = daysBetween(now, dueDate);
        const trigger = computeTrigger(diff, daysBefore, daysAfter);
        if (!trigger) continue;

        const alreadySent = await prisma.reminder.findFirst({
          where: { tenantId: tenant.id, trigger, sentAt: { gte: todayStart } },
        });
        if (alreadySent) {
          skipped++;
          firedForTenant = true;
          continue;
        }

        const amount = payment?.amount ?? tenant.unit.rentAmount;
        const message = buildReminderMessage(tenant.name, amount, dueDate, trigger, account.ownerName);
        const channelsUsed: string[] = [];
        let anySuccess = false;

        if (config.smsEnabled && tenant.phone) {
          if (await sendSMS(tenant.phone, message)) {
            channelsUsed.push("sms");
            anySuccess = true;
          }
        }
        if (config.emailEnabled && tenant.email) {
          const ok = await sendPaymentReminder(
            tenant.email,
            tenant.name,
            amount,
            dueDate,
            account.ownerName,
            account.gcashNumber,
            account.mayaNumber
          );
          if (ok) {
            channelsUsed.push("email");
            anySuccess = true;
          }
        }
        if (config.inAppEnabled) {
          await prisma.notice.create({
            data: {
              tenantId: tenant.id,
              accountId: config.accountId,
              title: trigger === "due_date" ? "Rent due today" : trigger.includes("before") ? "Upcoming rent due" : "Rent overdue",
              content: message,
              type: "reminder",
            },
          });
          channelsUsed.push("in_app");
          anySuccess = true;
        }

        await prisma.reminder.create({
          data: {
            tenantId: tenant.id,
            type: channelsUsed.join(",") || "none",
            trigger,
            message,
            status: anySuccess ? "sent" : "failed",
          },
        });

        if (anySuccess) sent++;
        else failed++;
        firedForTenant = true;
      }

      if (!firedForTenant) skipped++;
    }
  }

  return { sent, skipped, failed };
}
