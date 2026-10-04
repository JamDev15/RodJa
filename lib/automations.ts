import { prisma } from "@/lib/prisma";
import type { Account, Automation, MonthlyLedger, Payment, Property, Tenant, Unit } from "@prisma/client";
import { sendAutomationEmail, APP_URL } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { sendPushToAccount } from "@/lib/push";
import { logMessage, type LogContext } from "@/lib/message-log";
import { daysBetween, dueDateForMonth, monthKeyOf, shiftMonthKey, toPhDateOnly } from "@/lib/due-dates";
import { getMonthLabel } from "@/lib/utils";

import { AUTOMATION_CHANNELS, type AutomationChannel } from "@/lib/automation-meta";
export * from "@/lib/automation-meta";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(n);
const longDate = (d: Date) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(d);

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

export type TenantFull = Tenant & {
  unit: Unit & { property: Property };
  ledger: MonthlyLedger[];
  payments: Payment[];
  contracts: { endDate: Date | null }[];
};

function ledgerBalance(l: MonthlyLedger): number {
  const bill = (billed: number | null, paid: number | null, isPaid: boolean) => {
    if (!billed) return 0;
    if (paid != null) return Math.max(0, billed - paid);
    return isPaid ? 0 : billed;
  };
  return (
    bill(l.rentAmount, l.rentPaidAmount, l.rentPaid) +
    bill(l.electricAmount, l.electricPaidAmount, l.electricPaid) +
    bill(l.waterAmount, l.waterPaidAmount, l.waterPaid) +
    bill(l.otherAmount, l.otherPaidAmount, l.otherPaid) +
    (l.balancePaid ? 0 : l.balance)
  );
}

/**
 * What a tenant still owes for a bill month. The itemized MonthlyLedger is
 * the source of truth when the owner keeps one; otherwise fall back to the
 * Payment record (approved/waived = settled) and finally to the unit's rent.
 */
export function amountDueFor(tenant: TenantFull, monthKey: string): number {
  const ledger = tenant.ledger.find((l) => l.month === monthKey);
  if (ledger) return ledgerBalance(ledger);
  const payment = tenant.payments.find((p) => p.month === monthKey);
  if (payment && ["approved", "waived"].includes(payment.status)) return 0;
  return payment?.amount ?? tenant.unit.rentAmount;
}

export function leaseEndOf(tenant: TenantFull): Date | null {
  if (tenant.moveOutDate) return tenant.moveOutDate;
  const fromContract = tenant.contracts.map((c) => c.endDate).filter((d): d is Date => !!d);
  if (fromContract.length === 0) return null;
  return fromContract.sort((a, b) => b.getTime() - a.getTime())[0];
}

export interface Match {
  periodKey: string;
  monthKey: string;
  dueDate: Date | null;
  leaseEnd: Date | null;
}

/** Decides whether an automation fires for this tenant today, and for which period. */
export function matchAutomation(automation: Pick<Automation, "trigger" | "offsetDays">, tenant: TenantFull, now: Date): Match | null {
  const thisMonth = monthKeyOf(now);
  const n = automation.offsetDays;

  if (automation.trigger === "day_of_month") {
    const today = toPhDateOnly(now);
    const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
    if (today.getUTCDate() !== Math.min(Math.max(n, 1), lastDay)) return null;
    return { periodKey: `month:${thisMonth}`, monthKey: thisMonth, dueDate: dueDateForMonth(thisMonth, tenant.dueDay), leaseEnd: leaseEndOf(tenant) };
  }

  if (automation.trigger === "lease_end") {
    const end = leaseEndOf(tenant);
    if (!end || daysBetween(now, end) !== -n) return null;
    return { periodKey: `lease:${end.toISOString().slice(0, 10)}`, monthKey: thisMonth, dueDate: null, leaseEnd: end };
  }

  // Due-date based triggers: look at last, this, and next month's due date so
  // "3 days before" can reach into next month and "7 days overdue" back into last.
  for (const monthKey of [shiftMonthKey(thisMonth, -1), thisMonth, shiftMonthKey(thisMonth, 1)]) {
    const due = dueDateForMonth(monthKey, tenant.dueDay);
    const diff = daysBetween(now, due); // negative = before due
    const hit =
      (automation.trigger === "before_due" && diff === -n) ||
      (automation.trigger === "on_due" && diff === 0) ||
      (automation.trigger === "after_due" && diff === n);
    if (hit) return { periodKey: `due:${monthKey}`, monthKey, dueDate: due, leaseEnd: leaseEndOf(tenant) };
  }
  return null;
}

export function varsFor(account: Account, tenant: TenantFull, automation: Pick<Automation, "offsetDays">, match: Match): Record<string, string> {
  return {
    tenant_name: tenant.name,
    first_name: tenant.name.split(/\s+/)[0] ?? tenant.name,
    amount_due: peso(amountDueFor(tenant, match.monthKey)),
    rent: peso(tenant.unit.rentAmount),
    due_date: match.dueDate ? longDate(match.dueDate) : "",
    days: String(automation.offsetDays),
    month: getMonthLabel(match.monthKey),
    property: tenant.unit.property.name,
    unit: tenant.unit.unitNumber,
    lease_end: match.leaseEnd ? longDate(match.leaseEnd) : "",
    owner_name: account.ownerName,
    business_name: account.name,
    gcash: account.gcashNumber ?? "",
    maya: account.mayaNumber ?? "",
    portal_link: `${APP_URL}/tenant/login`,
  };
}

export function channelsOf(automation: Pick<Automation, "channels">): AutomationChannel[] {
  const raw = Array.isArray(automation.channels) ? (automation.channels as unknown[]) : [];
  return raw.filter((c): c is AutomationChannel => (AUTOMATION_CHANNELS as readonly string[]).includes(String(c)));
}

/** Sends one automation to one tenant (and/or the owner about that tenant). Returns true if anything went out. */
async function deliver(account: Account, tenant: TenantFull, automation: Automation, vars: Record<string, string>): Promise<boolean> {
  const subject = fillTemplate(automation.subject, vars);
  const body = fillTemplate(automation.message, vars);
  const channels = channelsOf(automation);
  let any = false;

  if (automation.audience === "tenant" || automation.audience === "both") {
    const log: LogContext = { accountId: account.id, tenantId: tenant.id, recipientType: "tenant", recipientName: tenant.name, category: "automation" };
    if (channels.includes("email") && tenant.email) {
      if (await sendAutomationEmail(tenant.email, subject, body, account.ownerName, log)) any = true;
    }
    if (channels.includes("sms") && tenant.phone) {
      if (await sendSMS(tenant.phone, `${body}`.slice(0, 450), log)) any = true;
    }
    if (channels.includes("in_app")) {
      await prisma.notice.create({ data: { tenantId: tenant.id, accountId: account.id, title: subject, content: body, type: "reminder" } });
      await logMessage({ ...log, channel: "in_app", to: "Tenant portal", subject, body, status: "sent" });
      any = true;
    }
  }

  if (automation.audience === "owner" || automation.audience === "both") {
    const log: LogContext = { accountId: account.id, tenantId: tenant.id, recipientType: "owner", recipientName: account.ownerName, category: "automation" };
    const ownerSubject = automation.audience === "both" ? `[Copy] ${subject} — ${tenant.name}` : subject;
    if (channels.includes("email")) {
      if (await sendAutomationEmail(account.email, ownerSubject, body, "TenantHub", log)) any = true;
    }
    if (channels.includes("push")) {
      const { sent } = await sendPushToAccount(account.id, { title: ownerSubject, body: body.slice(0, 180), url: `/dashboard/tenants/${tenant.id}` }, log);
      if (sent > 0) any = true;
    }
    if (channels.includes("sms") && account.phone) {
      if (await sendSMS(account.phone, `${tenant.name}: ${body}`.slice(0, 450), log)) any = true;
    }
  }
  return any;
}

export interface AutomationSweepResult {
  sent: number;
  skipped: number;
  failed: number;
}

export const tenantInclude = (now: Date) => {
  const thisMonth = monthKeyOf(now);
  const months = [shiftMonthKey(thisMonth, -1), thisMonth, shiftMonthKey(thisMonth, 1)];
  return {
    unit: { include: { property: true } },
    ledger: { where: { month: { in: months } } },
    payments: { where: { month: { in: months } } },
    contracts: { where: { status: "signed" }, select: { endDate: true } },
  } as const;
};

/**
 * Runs every active automation (optionally only one account's). Each
 * (automation, tenant, period) fires at most once: an AutomationRun row is
 * claimed *before* sending, so overlapping cron/"run now" calls can't double-send.
 */
export async function runAutomationSweep(now: Date = new Date(), onlyAccountId?: string): Promise<AutomationSweepResult> {
  const result: AutomationSweepResult = { sent: 0, skipped: 0, failed: 0 };

  const automations = await prisma.automation.findMany({
    where: { isActive: true, account: { isActive: true }, ...(onlyAccountId ? { accountId: onlyAccountId } : {}) },
    include: { account: true },
    orderBy: { accountId: "asc" },
  });

  const tenantsByAccount = new Map<string, TenantFull[]>();
  for (const automation of automations) {
    const account = automation.account;
    if (!tenantsByAccount.has(account.id)) {
      const tenants = await prisma.tenant.findMany({
        where: { isActive: true, unit: { property: { accountId: account.id } } },
        include: tenantInclude(now),
      });
      tenantsByAccount.set(account.id, tenants as TenantFull[]);
    }

    for (const tenant of tenantsByAccount.get(account.id)!) {
      const match = matchAutomation(automation, tenant, now);
      if (!match) continue;

      const owes = amountDueFor(tenant, match.monthKey);
      // Overdue nudges only make sense while something is actually unpaid.
      const requireUnpaid = automation.onlyUnpaid || automation.trigger === "after_due";
      if (requireUnpaid && match.dueDate && owes <= 0) {
        result.skipped++;
        continue;
      }

      let runId: string;
      try {
        const run = await prisma.automationRun.create({
          data: { automationId: automation.id, tenantId: tenant.id, periodKey: match.periodKey, status: "sending" },
        });
        runId = run.id;
      } catch {
        result.skipped++; // already handled for this period
        continue;
      }

      const ok = await deliver(account, tenant, automation, varsFor(account, tenant, automation, match));
      if (ok) {
        await prisma.automationRun.update({ where: { id: runId }, data: { status: "sent" } });
        result.sent++;
      } else {
        // Nothing went out (e.g. tenant has no email and SMS isn't set up) —
        // release the claim so a same-day "Run now" can retry after a fix.
        // The failure itself is already visible in Message History.
        await prisma.automationRun.delete({ where: { id: runId } }).catch(() => {});
        result.failed++;
      }
    }

    await prisma.automation.update({ where: { id: automation.id }, data: { lastRunAt: now } });
  }

  return result;
}

/** Sends one sample of an automation to the owner's own email so they can see how it reads. */
export async function sendAutomationTest(automation: Automation, account: Account): Promise<boolean> {
  const sampleDue = dueDateForMonth(monthKeyOf(new Date()), 5);
  const vars: Record<string, string> = {
    tenant_name: "Juan dela Cruz",
    first_name: "Juan",
    amount_due: peso(5500),
    rent: peso(5000),
    due_date: longDate(sampleDue),
    days: String(automation.offsetDays),
    month: getMonthLabel(monthKeyOf(new Date())),
    property: "Sample Apartments",
    unit: "2B",
    lease_end: longDate(new Date(Date.now() + 30 * 86400000)),
    owner_name: account.ownerName,
    business_name: account.name,
    gcash: account.gcashNumber ?? "0917 000 0000",
    maya: account.mayaNumber ?? "",
    portal_link: `${APP_URL}/tenant/login`,
  };
  return sendAutomationEmail(
    account.email,
    `[Test] ${fillTemplate(automation.subject, vars)}`,
    `This is a test of your "${automation.name}" automation, filled with sample data.\n\n---\n\n${fillTemplate(automation.message, vars)}`,
    account.ownerName,
    { accountId: account.id, recipientType: "owner", recipientName: account.ownerName, category: "automation" }
  );
}
