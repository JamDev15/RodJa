import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProofPreview } from "@/components/ui/proof-preview";
import { BillingActions } from "./billing-actions";

export default async function AdminBillingPage() {
  const records = await prisma.billingRecord.findMany({
    include: { account: { select: { name: true, ownerName: true, email: true } } },
    orderBy: { dueDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Billing</h1>
        <p className="text-th-muted text-sm mt-1">Subscription payments across all accounts</p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-th-line bg-th-surface p-8 text-center text-th-faint text-sm">
          No billing records yet — they&apos;re created automatically for paid-plan accounts once their free trial ends.
        </div>
      ) : (
        <div className="rounded-xl border border-th-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface">
                <th className="text-left px-4 py-3 text-th-muted font-medium">Account</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Period</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden lg:table-cell">Due Date</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Reference #</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Proof</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-line">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-th-raised">
                  <td className="px-4 py-3 text-th-ink">
                    {r.account.name}
                    <p className="text-xs text-th-faint">{r.account.email}</p>
                  </td>
                  <td className="px-4 py-3 text-th-muted">{r.period}</td>
                  <td className="px-4 py-3 text-th-ink">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-th-muted hidden lg:table-cell">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "paid" ? "success" : r.status === "overdue" || r.status === "rejected" ? "destructive" : "warning"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-th-muted hidden md:table-cell">{r.referenceNumber ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ProofPreview url={r.proofUrl} label={`${r.account.name} — ${r.period}`} />
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== "paid" && <BillingActions recordId={r.id} hasSubmission={r.status === "submitted"} />}
                    <div className="mt-1 flex gap-3 text-xs">
                      <a href={`/api/admin/billing/${r.id}/pdf?type=invoice`} className="text-th-accent hover:text-th-accent">Invoice</a>
                      {r.status === "paid" && <a href={`/api/admin/billing/${r.id}/pdf?type=receipt`} className="text-th-paid hover:text-th-paid">Receipt</a>}
                    </div>
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
