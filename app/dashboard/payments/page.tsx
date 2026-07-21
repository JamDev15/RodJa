import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { ApprovePaymentButton } from "./approve-button";
import Link from "next/link";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; status?: string }>;
}) {
  const { month: qMonth, status: qStatus } = await searchParams;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  const month = qMonth ?? getCurrentMonth();

  const where: any = { tenant: { unit: { property: { accountId } } } };
  if (month) where.month = month;
  if (qStatus) where.status = qStatus;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      tenant: { include: { unit: { include: { property: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const submitted = payments.filter((p) => p.status === "submitted");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-gray-400 text-sm mt-1">{payments.length} records</p>
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          <form className="flex gap-2">
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <select
              name="status"
              defaultValue={qStatus ?? ""}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="late">Late</option>
              <option value="waived">Waived</option>
            </select>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Pending Approvals Banner */}
      {submitted.length > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-sm font-medium text-blue-300">
            {submitted.length} payment{submitted.length > 1 ? "s" : ""} waiting for your approval
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Unit</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Month</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Method</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {payments.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-500 py-8">No payments found</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/tenants/${p.tenantId}`} className="font-medium text-white hover:text-blue-400">
                    {p.tenant.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                  {p.tenant.unit.property.name} – {p.tenant.unit.unitNumber}
                </td>
                <td className="px-4 py-3 text-gray-400">{p.month}</td>
                <td className="px-4 py-3 text-white font-medium">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell capitalize">{p.method ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.status === "submitted" && (
                    <ApprovePaymentButton
                      paymentId={p.id}
                      proofUrl={p.proofUrl}
                      tenantName={p.tenant.name}
                      amount={p.amount}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
