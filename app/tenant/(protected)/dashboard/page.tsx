import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { CreditCard, Home, Phone, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function TenantDashboardPage() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: { include: { property: { include: { account: true } } } },
      payments: { orderBy: { dueDate: "desc" }, take: 6 },
    },
  });

  if (!tenant) return null;

  const account = tenant.unit.property.account;
  const currentMonth = getCurrentMonth();
  const currentPayment = tenant.payments.find((p) => p.month === currentMonth);
  const overduePayments = tenant.payments.filter((p) => p.status === "late");

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white">Hi, {tenant.name.split(" ")[0]}! 👋</h1>
        <p className="text-gray-500 text-sm">{tenant.unit.property.name} · Unit {tenant.unit.unitNumber}</p>
      </div>

      {/* Overdue Alert */}
      {overduePayments.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">Overdue Payment</p>
            <p className="text-xs text-red-400/80 mt-0.5">You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}. Please settle immediately.</p>
          </div>
        </div>
      )}

      {/* Current Month */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs text-gray-500 mb-1">This Month&apos;s Rent</p>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold text-white">{formatCurrency(tenant.unit.rentAmount)}</p>
          {currentPayment && <PaymentBadge status={currentPayment.status} />}
        </div>
        {currentPayment?.dueDate && (
          <p className="text-xs text-gray-500 mt-1">Due: {formatDate(currentPayment.dueDate)}</p>
        )}
        {(!currentPayment || ["pending", "late"].includes(currentPayment?.status ?? "")) && (
          <Link
            href="/tenant/pay"
            className="flex items-center justify-center gap-2 w-full mt-4 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Pay Now
          </Link>
        )}
      </div>

      {/* Landlord Payment Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Payment Details</h2>
        {account.gcashNumber && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">GCash</span>
            <span className="text-white font-mono">{account.gcashNumber}</span>
          </div>
        )}
        {account.mayaNumber && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Maya</span>
            <span className="text-white font-mono">{account.mayaNumber}</span>
          </div>
        )}
        {account.bankDetails && (
          <div className="text-sm">
            <span className="text-gray-500">Bank</span>
            <p className="text-white mt-0.5">{account.bankDetails}</p>
          </div>
        )}
        {!account.gcashNumber && !account.mayaNumber && !account.bankDetails && (
          <p className="text-sm text-gray-500">Contact your landlord for payment details.</p>
        )}
      </div>

      {/* Recent Payments */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Payment History</h2>
        <div className="space-y-2">
          {tenant.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{p.month}</p>
                <p className="text-xs text-gray-500">{formatCurrency(p.amount)}</p>
              </div>
              <PaymentBadge status={p.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Unit Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Unit Info</h2>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Home className="h-4 w-4" />
          Unit {tenant.unit.unitNumber} · {tenant.unit.property.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Phone className="h-4 w-4" />
          Landlord: {account.ownerName} · {account.phone ?? account.email}
        </div>
      </div>
    </div>
  );
}
