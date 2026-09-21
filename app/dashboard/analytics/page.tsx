import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentMonth, getMonthLabel, formatCurrency } from "@/lib/utils";
import { shiftMonthKey } from "@/lib/due-dates";
import { AnalyticsChart, type MonthlyBillTotals } from "@/components/dashboard/analytics-chart";

const MONTHS_BACK = 6;

export default async function AnalyticsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  const currentMonth = getCurrentMonth();

  const monthKeys = Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonthKey(currentMonth, i - (MONTHS_BACK - 1)));

  const payments = await prisma.payment.findMany({
    where: {
      status: "approved",
      month: { in: monthKeys },
      tenant: { unit: { property: { accountId } } },
    },
    select: { month: true, amount: true, rentAmount: true, electricAmount: true, waterAmount: true },
  });

  const byMonth = new Map<string, MonthlyBillTotals>(
    monthKeys.map((month) => [month, { month, label: getMonthLabel(month), rent: 0, electric: 0, water: 0, other: 0, total: 0 }])
  );

  for (const p of payments) {
    const row = byMonth.get(p.month);
    if (!row) continue;
    const rent = p.rentAmount ?? 0;
    const electric = p.electricAmount ?? 0;
    const water = p.waterAmount ?? 0;
    // Payments recorded before the bill-breakdown fields existed (or entered
    // without one) still had a real lump amount — attribute the unaccounted
    // remainder to "Other" rather than silently dropping it from the total.
    const other = Math.max(0, p.amount - rent - electric - water);
    row.rent += rent;
    row.electric += electric;
    row.water += water;
    row.other += other;
    row.total += p.amount;
  }

  const data = monthKeys.map((m) => byMonth.get(m)!);
  const grandTotal = data.reduce((s, d) => s + d.total, 0);
  const totals = {
    rent: data.reduce((s, d) => s + d.rent, 0),
    electric: data.reduce((s, d) => s + d.electric, 0),
    water: data.reduce((s, d) => s + d.water, 0),
    other: data.reduce((s, d) => s + d.other, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Collected payments by bill type, last {MONTHS_BACK} months</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Rent</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.rent)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Electric (Kuryente)</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.electric)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Water</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.water)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-gray-500">Other</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(totals.other)}</p>
        </div>
      </div>

      {grandTotal === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-gray-400 font-medium">No approved payments yet in this window</p>
          <p className="text-gray-600 text-sm mt-1">Once payments are approved, monthly totals will show up here.</p>
        </div>
      ) : (
        <AnalyticsChart data={data} />
      )}
    </div>
  );
}
