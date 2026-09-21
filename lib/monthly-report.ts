import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { sendMonthlyReport } from "@/lib/email";
import { toPhDateOnly, monthKeyOf, shiftMonthKey } from "@/lib/due-dates";
import { getMonthLabel } from "@/lib/utils";

export interface MonthlyReportTotals {
  collected: number;
  rent: number;
  electric: number;
  water: number;
  other: number;
  billed: number;
  outstanding: number;
}

const PESO_FMT = '"₱"#,##0.00';

/**
 * Builds the Pro-plan monthly report workbook for one account/month, sourced
 * from that month's Payment rows — the same fields and "unaccounted amount
 * falls into Other" rule as app/dashboard/analytics/page.tsx, so the emailed
 * numbers always match what the landlord sees in-app.
 */
export async function buildMonthlyReportWorkbook(accountId: string, monthKey: string) {
  const payments = await prisma.payment.findMany({
    where: { month: monthKey, tenant: { unit: { property: { accountId } } } },
    include: { tenant: { include: { unit: { include: { property: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const totals: MonthlyReportTotals = { collected: 0, rent: 0, electric: 0, water: 0, other: 0, billed: 0, outstanding: 0 };

  for (const p of payments) {
    totals.billed += p.amount;
    if (p.status === "approved") {
      const rent = p.rentAmount ?? 0;
      const electric = p.electricAmount ?? 0;
      const water = p.waterAmount ?? 0;
      const other = Math.max(0, p.amount - rent - electric - water);
      totals.rent += rent;
      totals.electric += electric;
      totals.water += water;
      totals.other += other;
      totals.collected += p.amount;
    } else if (!["waived"].includes(p.status)) {
      totals.outstanding += p.amount;
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TenantHub";
  workbook.created = new Date();

  const monthLabel = getMonthLabel(monthKey);

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Amount", key: "amount", width: 18 },
  ];
  summary.addRows([
    { metric: `Report month`, amount: monthLabel },
    { metric: "Total Collected (approved)", amount: totals.collected },
    { metric: "  Rent", amount: totals.rent },
    { metric: "  Electric (Kuryente)", amount: totals.electric },
    { metric: "  Water", amount: totals.water },
    { metric: "  Other", amount: totals.other },
    { metric: "Total Billed (all statuses)", amount: totals.billed },
    { metric: "Total Outstanding (not yet approved)", amount: totals.outstanding },
  ]);
  summary.getColumn("amount").numFmt = PESO_FMT;
  summary.getRow(1).font = { bold: true };

  const detail = workbook.addWorksheet("Payments");
  detail.columns = [
    { header: "Tenant", key: "tenant", width: 24 },
    { header: "Property", key: "property", width: 20 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Rent", key: "rent", width: 14 },
    { header: "Electric", key: "electric", width: 14 },
    { header: "Water", key: "water", width: 14 },
    { header: "Other", key: "other", width: 14 },
    { header: "Total", key: "total", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Method", key: "method", width: 12 },
    { header: "Date", key: "date", width: 14 },
  ];
  for (const p of payments) {
    const rent = p.rentAmount ?? 0;
    const electric = p.electricAmount ?? 0;
    const water = p.waterAmount ?? 0;
    const other = Math.max(0, p.amount - rent - electric - water);
    detail.addRow({
      tenant: p.tenant.name,
      property: p.tenant.unit.property.name,
      unit: p.tenant.unit.unitNumber,
      rent,
      electric,
      water,
      other,
      total: p.amount,
      status: p.status,
      method: p.method ?? "—",
      date: p.paidDate ? formatDateOnly(p.paidDate) : formatDateOnly(p.dueDate),
    });
  }
  detail.getRow(1).font = { bold: true };
  ["rent", "electric", "water", "other", "total"].forEach((key) => {
    detail.getColumn(key).numFmt = PESO_FMT;
  });

  // exceljs's own .d.ts declares a global `Buffer extends ArrayBuffer`
  // ambient interface (for browser compatibility) that shadows and
  // conflicts with @types/node's real Buffer — wrap through Buffer.from
  // to get back a real Node Buffer for the Resend attachment below.
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, totals, monthLabel };
}

function formatDateOnly(date: Date): string {
  return toPhDateOnly(date).toISOString().split("T")[0];
}

export interface MonthlyReportSweepResult {
  sent: number;
  skipped: number;
}

/**
 * Runs at most once a month in practice: only does real work on the 1st of
 * the month (Philippine local time), reporting on the month that just
 * ended. Firing on the 1st rather than trying to catch the exact last day
 * avoids the varying-month-length edge case and guarantees the full
 * month's payments are already recorded. Rides the existing daily cron
 * (app/api/cron/daily/route.ts) rather than needing a second cron entry.
 */
export async function runMonthlyReportSweep(now: Date = new Date()): Promise<MonthlyReportSweepResult> {
  const result: MonthlyReportSweepResult = { sent: 0, skipped: 0 };

  const phNow = toPhDateOnly(now);
  if (phNow.getUTCDate() !== 1) return result;

  const monthKey = shiftMonthKey(monthKeyOf(now), -1);

  const accounts = await prisma.account.findMany({
    where: { isActive: true, plan: { name: "Pro" } },
  });

  for (const account of accounts) {
    const already = await prisma.monthlyReportLog.findUnique({
      where: { accountId_monthKey: { accountId: account.id, monthKey } },
    });
    if (already) {
      result.skipped++;
      continue;
    }

    const { buffer, totals, monthLabel } = await buildMonthlyReportWorkbook(account.id, monthKey);
    const ok = await sendMonthlyReport(account.email, account.ownerName, monthLabel, totals, buffer);
    if (ok) {
      await prisma.monthlyReportLog.create({ data: { accountId: account.id, monthKey } });
      result.sent++;
    }
  }

  return result;
}
