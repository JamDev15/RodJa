import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BillingActions } from "./billing-actions";

export default async function AdminBillingPage() {
  const records = await prisma.billingRecord.findMany({
    include: { account: { select: { name: true, ownerName: true, email: true } } },
    orderBy: { dueDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 text-sm mt-1">Subscription payments across all accounts</p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-gray-500 text-sm">
          No billing records yet — they're created automatically for paid-plan accounts once their free trial ends.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Account</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Period</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Due Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Reference #</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Proof</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">
                    {r.account.name}
                    <p className="text-xs text-gray-500">{r.account.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{r.period}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "paid" ? "success" : r.status === "overdue" ? "destructive" : "warning"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{r.referenceNumber ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {r.proofUrl ? (
                      <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">View</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== "paid" && <BillingActions recordId={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
