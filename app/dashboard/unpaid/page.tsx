import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils";
import { computeUnpaidRows } from "@/lib/unpaid";

export default async function UnpaidPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  const currentMonth = getCurrentMonth();
  const now = new Date();

  const [tenants, currentMonthPayments] = await Promise.all([
    prisma.tenant.findMany({
      where: { isActive: true, unit: { property: { accountId } } },
      include: { unit: { include: { property: true } } },
    }),
    prisma.payment.findMany({
      where: { month: currentMonth, tenant: { unit: { property: { accountId } } } },
    }),
  ]);

  const allRows = computeUnpaidRows(tenants, currentMonthPayments, currentMonth, now);
  const rows = status ? allRows.filter((r) => r.status === status) : allRows;
  const title = status === "late" ? "Overdue" : status === "pending" ? "Pending" : "Who Hasn't Paid";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-gray-400 text-sm mt-1">{rows.length} tenant{rows.length === 1 ? "" : "s"}, {currentMonth}</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">No one here</p>
          <p className="text-gray-600 text-sm">Everyone in this bucket is paid up.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tenant</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Unit</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Due Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((r) => (
                <tr key={r.tenantId} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">
                    <Link href={`/dashboard/tenants/${r.tenantId}`} className="hover:text-blue-400">{r.tenantName}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{r.unitLabel}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {formatDate(r.dueDate)}
                    {r.daysOverdue > 0 && (
                      <span className="text-red-400 text-xs ml-1">({r.daysOverdue}d overdue)</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><PaymentBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
