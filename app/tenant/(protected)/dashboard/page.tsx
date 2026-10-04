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
        <h1 className="text-xl font-bold text-th-ink">Hi, {tenant.name.split(" ")[0]}! 👋</h1>
        <p className="text-th-faint text-sm">{tenant.unit.property.name} · Unit {tenant.unit.unitNumber}</p>
      </div>

      {/* Overdue Alert */}
      {overduePayments.length > 0 && (
        <div className="rounded-xl border border-th-danger/30 bg-th-danger-soft p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-th-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-th-danger">Overdue Payment</p>
            <p className="text-xs text-th-danger/80 mt-0.5">You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}. Please settle immediately.</p>
          </div>
        </div>
      )}

      {/* Current Month */}
      <div className="rounded-xl border border-th-line bg-th-surface p-5">
        <p className="text-xs text-th-faint mb-1">This Month&apos;s Rent</p>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold text-th-ink">{formatCurrency(tenant.unit.rentAmount)}</p>
          {currentPayment && <PaymentBadge status={currentPayment.status} />}
        </div>
        {currentPayment?.dueDate && (
          <p className="text-xs text-th-faint mt-1">Due: {formatDate(currentPayment.dueDate)}</p>
        )}
        {(!currentPayment || ["pending", "late"].includes(currentPayment?.status ?? "")) && (
          <Link
            href="/tenant/pay"
            className="flex items-center justify-center gap-2 w-full mt-4 rounded-lg bg-th-brand py-2.5 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Pay Now
          </Link>
        )}
      </div>

      {/* Landlord Payment Info */}
      <div className="rounded-xl border border-th-line bg-th-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-th-ink">Payment Details</h2>
        {account.gcashNumber && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-th-faint">GCash</span>
            <span className="text-th-ink font-mono">{account.gcashNumber}</span>
          </div>
        )}
        {account.mayaNumber && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-th-faint">Maya</span>
            <span className="text-th-ink font-mono">{account.mayaNumber}</span>
          </div>
        )}
        {account.bankDetails && (
          <div className="text-sm">
            <span className="text-th-faint">Bank</span>
            <p className="text-th-ink mt-0.5">{account.bankDetails}</p>
          </div>
        )}
        {!account.gcashNumber && !account.mayaNumber && !account.bankDetails && (
          <p className="text-sm text-th-faint">Contact your landlord for payment details.</p>
        )}
      </div>

      {/* Recent Payments */}
      <div>
        <h2 className="text-sm font-semibold text-th-ink mb-2">Payment History</h2>
        <div className="space-y-2">
          {tenant.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-th-line bg-th-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-th-ink">{p.month}</p>
                <p className="text-xs text-th-faint">{formatCurrency(p.amount)}</p>
              </div>
              <PaymentBadge status={p.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Unit Info */}
      <div className="rounded-xl border border-th-line bg-th-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-th-ink">Unit Info</h2>
        <div className="flex items-center gap-2 text-sm text-th-muted">
          <Home className="h-4 w-4" />
          Unit {tenant.unit.unitNumber} · {tenant.unit.property.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-th-muted">
          <Phone className="h-4 w-4" />
          Landlord: {account.ownerName} · {account.phone ?? account.email}
        </div>
      </div>
    </div>
  );
}
