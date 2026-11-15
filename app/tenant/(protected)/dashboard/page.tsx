import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { CreditCard, Home, Phone, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getProfile } from "@/lib/collections/profile";
import { loadTenantLedger } from "@/lib/collections/ledger";
import { todayIn } from "@/lib/collections/calendar";
import { formatCentavos } from "@/lib/collections/money";
import { MessageSquare, Users } from "lucide-react";
import { isUnread } from "@/lib/operations/messages";

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

  // Properties on statement billing show the live balance from the
  // collections ledger instead of the legacy one-payment-per-month card.
  const profile = await getProfile(tenant.unit.propertyId);
  const billing = profile?.enabled ? await loadTenantLedger(prisma, tenant.id, todayIn(profile.timezone)) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-th-ink">Hi, {tenant.name.split(" ")[0]}! 👋</h1>
        <p className="text-th-faint text-sm">{tenant.unit.property.name} · Unit {tenant.unit.unitNumber}</p>
      </div>

      {billing && (
        <Link href="/tenant/billing" className="block rounded-xl border border-th-line bg-th-surface p-5">
          <p className="text-xs text-th-faint mb-1">{billing.creditCentavos > billing.outstandingCentavos ? "Credit on your account" : "Balance due"}</p>
          <p className="text-3xl font-bold text-th-ink">{formatCentavos(Math.abs(billing.netBalanceCentavos))}</p>
          {billing.overdueCentavos > 0 && <p className="mt-1 text-sm text-th-danger">{formatCentavos(billing.overdueCentavos)} is past due</p>}
          <span className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-th-brand py-2.5 text-sm font-medium text-th-on-brand">
            <CreditCard className="h-4 w-4" /> Statements &amp; payments
          </span>
        </Link>
      )}

      {billing && <HouseholdAndMessages tenantId={tenant.id} />}

      {/* Overdue Alert */}
      {!billing && overduePayments.length > 0 && (
        <div className="rounded-xl border border-th-danger/30 bg-th-danger-soft p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-th-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-th-danger">Overdue Payment</p>
            <p className="text-xs text-th-danger/80 mt-0.5">You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}. Please settle immediately.</p>
          </div>
        </div>
      )}

      {/* Current Month */}
      {!billing && <div className="rounded-xl border border-th-line bg-th-surface p-5">
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
      </div>}

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
      {!billing && <div>
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
      </div>}

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

/** Phase 2 (properties with the Dawson feature set on): household names and messages. */
async function HouseholdAndMessages({ tenantId }: { tenantId: string }) {
  const [occupants, threads] = await Promise.all([
    prisma.occupant.findMany({ where: { tenantId, movedOutOn: null }, select: { id: true, name: true, relationship: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
    prisma.messageThread.findMany({ where: { tenantId }, select: { lastMessageAt: true, lastSenderRole: true, adminReadAt: true, tenantReadAt: true } }),
  ]);
  const unread = threads.filter((t) => isUnread(t, "TENANT")).length;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/tenant/messages" className="rounded-xl border border-th-line bg-th-surface p-4">
        <MessageSquare className="h-5 w-5 text-th-accent" />
        <p className="mt-2 text-sm font-medium text-th-ink">Messages</p>
        <p className="text-xs text-th-faint">{unread ? `${unread} new repl${unread === 1 ? "y" : "ies"}` : "Write to the office"}</p>
      </Link>
      <div className="rounded-xl border border-th-line bg-th-surface p-4">
        <Users className="h-5 w-5 text-th-accent" />
        <p className="mt-2 text-sm font-medium text-th-ink">Household</p>
        <p className="text-xs text-th-faint">{occupants.length ? occupants.map((o) => o.name).join(", ") : "Not recorded yet"}</p>
      </div>
    </div>
  );
}
