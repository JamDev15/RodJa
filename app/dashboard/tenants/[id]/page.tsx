import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar, Home, Pencil } from "lucide-react";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AddPaymentButton } from "./add-payment-button";
import { TenantLedger } from "@/components/dashboard/tenant-ledger";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const tenant = await prisma.tenant.findFirst({
    where: { id, unit: { property: { accountId } } },
    include: {
      unit: { include: { property: true } },
      payments: { orderBy: { dueDate: "desc" } },
      maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!tenant) notFound();

  const totalPaid = tenant.payments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = tenant.payments.filter((p) => ["pending", "submitted"].includes(p.status)).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tenants" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-gray-400 text-sm">{tenant.unit.property.name} – Unit {tenant.unit.unitNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={tenant.isActive ? "success" : "secondary"}>{tenant.isActive ? "Active" : "Past"}</Badge>
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <h3 className="font-semibold text-white">Contact Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400"><Phone className="h-4 w-4" />{tenant.phone}</div>
            {tenant.email && <div className="flex items-center gap-2 text-gray-400"><Mail className="h-4 w-4" />{tenant.email}</div>}
            <div className="flex items-center gap-2 text-gray-400"><Calendar className="h-4 w-4" />Moved in {formatDate(tenant.moveInDate)}</div>
            <div className="flex items-center gap-2 text-gray-400"><Home className="h-4 w-4" />Unit {tenant.unit.unitNumber} · {formatCurrency(tenant.unit.rentAmount)}/mo</div>
          </div>
          <div className="pt-2 text-xs text-gray-500">
            Portal PIN: <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">{tenant.portalPin}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-green-500/10 p-4 text-center">
            <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Paid</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-yellow-500/10 p-4 text-center">
            <p className="text-xl font-bold text-yellow-400">{formatCurrency(pendingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">Pending</p>
          </div>
          {tenant.depositAmount && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center col-span-2">
              <p className="text-xl font-bold text-white">{formatCurrency(tenant.depositAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">Deposit</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Bill Tracker */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Monthly Bill Tracker</h2>
          <p className="text-xs text-gray-500 mt-0.5">Rent · Electric · Water · Other — per month since {formatDate(tenant.moveInDate)}</p>
        </div>
        <TenantLedger
          tenantId={tenant.id}
          moveInDate={tenant.moveInDate}
          defaultRent={tenant.unit.rentAmount}
        />
      </div>

      {/* Payments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Payment History</h2>
          <AddPaymentButton tenantId={tenant.id} rentAmount={tenant.unit.rentAmount} />
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Month</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Due Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Method</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tenant.payments.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-8">No payment records</td></tr>
              )}
              {tenant.payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-medium">{p.month}</td>
                  <td className="px-4 py-3 text-white">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell capitalize">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">View</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Requests */}
      {tenant.maintenanceRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Maintenance Requests</h2>
          <div className="space-y-2">
            {tenant.maintenanceRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{req.title}</p>
                  <p className="text-xs text-gray-500">{formatDate(req.createdAt)}</p>
                </div>
                <Badge variant={req.status === "resolved" ? "success" : req.status === "in_progress" ? "default" : "warning"}>
                  {req.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
