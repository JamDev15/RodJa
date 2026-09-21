import { prisma } from "@/lib/prisma";
import type { MonthlyLedger } from "@prisma/client";
import { sendOwnerBillReminder, sendTenantBillReminder } from "@/lib/email";
import { sendPushToAccount } from "@/lib/push";
import { daysBetween, monthKeyOf, dueDateForMonth } from "@/lib/due-dates";

export interface BillReminderSweepResult {
  sent: number;
  skipped: number;
  failed: number;
}

type BillType = "rent" | "electric" | "water" | "other";
const BILL_TYPES: BillType[] = ["rent", "electric", "water", "other"];

function billLabel(billType: BillType, otherLabel: string | null): string {
  if (billType === "rent") return "Rent";
  if (billType === "electric") return "Electric bill";
  if (billType === "water") return "Water bill";
  return otherLabel || "Other bill";
}

function getBillAmount(ledger: MonthlyLedger, billType: BillType): number | null {
  switch (billType) {
    case "rent": return ledger.rentAmount;
    case "electric": return ledger.electricAmount;
    case "water": return ledger.waterAmount;
    case "other": return ledger.otherAmount;
  }
}

function getBillPaid(ledger: MonthlyLedger, billType: BillType): boolean {
  switch (billType) {
    case "rent": return ledger.rentPaid;
    case "electric": return ledger.electricPaid;
    case "water": return ledger.waterPaid;
    case "other": return ledger.otherPaid;
  }
}

/**
 * Itemized per-bill reminders (rent/electric/water/other), separate from
 * the lump-sum tenant-only reminders in lib/reminders.ts. Fires on a fixed
 * 2-days-before / 1-day-before / due-date schedule to both the owner
 * (email + push) and the tenant (email), and simply stops once that
 * specific bill is marked paid on the MonthlyLedger row — re-evaluated
 * fresh every run, so no separate cancellation step is needed.
 */
export async function runBillReminderSweep(now: Date = new Date()): Promise<BillReminderSweepResult> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const monthKey = monthKeyOf(now);

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: {
      properties: {
        include: {
          units: {
            include: {
              tenants: {
                where: { isActive: true },
                include: { ledger: { where: { month: monthKey } } },
              },
            },
          },
        },
      },
    },
  });

  for (const account of accounts) {
    const tenants = account.properties.flatMap((p) => p.units.flatMap((u) => u.tenants));

    for (const tenant of tenants) {
      const ledger = tenant.ledger[0];
      if (!ledger) continue;

      const dueDate = dueDateForMonth(monthKey, tenant.dueDay);
      const diff = daysBetween(now, dueDate);
      const trigger = diff === -2 ? "2days_before" : diff === -1 ? "1day_before" : diff === 0 ? "due_date" : null;
      if (!trigger) continue;

      for (const billType of BILL_TYPES) {
        const amount = getBillAmount(ledger, billType);
        const paid = getBillPaid(ledger, billType);
        if (amount == null || paid) continue;

        const label = billLabel(billType, ledger.otherLabel);

        const existing = await prisma.billReminder.findUnique({
          where: { ledgerId_billType_trigger: { ledgerId: ledger.id, billType, trigger } },
        });
        if (existing?.ownerEmailSent && existing?.ownerPushSent && existing?.tenantEmailSent) {
          skipped++;
          continue;
        }

        let ownerEmailSent = existing?.ownerEmailSent ?? false;
        let ownerPushSent = existing?.ownerPushSent ?? false;
        let tenantEmailSent = existing?.tenantEmailSent ?? false;
        let anySuccess = false;

        if (!ownerEmailSent) {
          ownerEmailSent = await sendOwnerBillReminder(account.email, account.ownerName, tenant.name, label, amount, dueDate, trigger);
          if (ownerEmailSent) anySuccess = true;
        }
        if (!ownerPushSent) {
          const phrase = trigger === "due_date" ? "due today" : trigger === "1day_before" ? "due tomorrow" : "due in 2 days";
          const { sent: pushSent } = await sendPushToAccount(account.id, {
            title: `${label} ${phrase}`,
            body: `${tenant.name} — ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(amount)}`,
            url: "/dashboard/tenants",
          });
          if (pushSent > 0) {
            ownerPushSent = true;
            anySuccess = true;
          }
        }
        if (!tenantEmailSent && tenant.email) {
          tenantEmailSent = await sendTenantBillReminder(tenant.email, tenant.name, label, amount, dueDate, trigger, account.ownerName);
          if (tenantEmailSent) anySuccess = true;
        }

        await prisma.billReminder.upsert({
          where: { ledgerId_billType_trigger: { ledgerId: ledger.id, billType, trigger } },
          update: { ownerEmailSent, ownerPushSent, tenantEmailSent },
          create: { ledgerId: ledger.id, billType, trigger, ownerEmailSent, ownerPushSent, tenantEmailSent },
        });

        if (anySuccess) sent++;
        else failed++;
      }
    }
  }

  return { sent, skipped, failed };
}
