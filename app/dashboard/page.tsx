import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, getMonthLabel, getCurrentMonth } from "@/lib/utils";
import { daysBetween, dueDateForMonth } from "@/lib/due-dates";
import { StatCard } from "@/components/dashboard/stat-card";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { DollarSign, Home, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  const currentMonth = getCurrentMonth();
  const now = new Date();

  const [properties, allPayments, tenants, account, reminderConfig] = await Promise.all([
    prisma.property.findMany({
      where: { accountId },
      include: { units: { include: { tenants: { where: { isActive: true } } } } },
    }),
    prisma.payment.findMany({
      where: { month: currentMonth, tenant: { unit: { property: { accountId } } } },
      include: { tenant: { include: { unit: { include: { property: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.findMany({
      where: { isActive: true, unit: { property: { accountId } } },
      include: { unit: { include: { property: true } } },
    }),
    prisma.account.findUnique({
      where: { id: accountId },
      select: { gcashNumber: true, mayaNumber: true, bankDetails: true },
    }),
    prisma.reminderConfig.findUnique({ where: { accountId } }),
  ]);

  const allUnits = properties.flatMap((p) => p.units);
  const totalUnits = allUnits.length;
  const occupiedUnits = allUnits.filter((u) => u.status === "occupied").length;
  const vacantUnits = allUnits.filter((u) => u.status === "vacant").length;

  // Tenants with no Payment row yet this month (not billed/submitted at all)
  // are otherwise invisible to the stats below — a rent due date has still
  // passed or is approaching for them even without a record, so they're
  // resolved against the same day-5 default the reminder engine uses.
  const unpaidRows = tenants
    .map((tenant) => {
      const payment = allPayments.find((p) => p.tenantId === tenant.id);
      if (payment && ["approved", "waived"].includes(payment.status)) return null;
      const dueDate = payment?.dueDate ?? dueDateForMonth(currentMonth, tenant.dueDay);
      const diff = daysBetween(now, dueDate);
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitLabel: `${tenant.unit.property.name} – ${tenant.unit.unitNumber}`,
        amount: payment?.amount ?? tenant.unit.rentAmount,
        dueDate,
        status: payment?.status ?? (diff > 0 ? "late" : "pending"),
        daysOverdue: diff,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const collected = allPayments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const collectedCount = allPayments.filter((p) => p.status === "approved").length;

  const pendingRows = unpaidRows.filter((r) => r.status === "pending" || r.status === "submitted");
  const overdueRows = unpaidRows.filter((r) => r.status === "late");
  const pending = pendingRows.reduce((s, r) => s + r.amount, 0);
  const overdue = overdueRows.reduce((s, r) => s + r.amount, 0);

  const recentPayments = allPayments.slice(0, 8);

  const gettingStartedSteps = [
    {
      label: "Add your first property",
      description: "Register a property so you can start adding units to it.",
      href: "/dashboard/properties/new",
      done: properties.length > 0,
    },
    {
      label: "Add a unit",
      description: "Units are what tenants get assigned to, with their own rent amount.",
      href: properties[0] ? `/dashboard/properties/${properties[0].id}/units/new` : "/dashboard/properties",
      done: totalUnits > 0,
    },
    {
      label: "Add your first tenant",
      description: "Assign a tenant to a unit and set their portal PIN.",
      href: "/dashboard/tenants/new",
      done: tenants.length > 0,
    },
    {
      label: "Set up your payment info",
      description: "Add your GCash/Maya number or bank details so tenants know where to pay.",
      href: "/dashboard/settings",
      done: !!(account?.gcashNumber || account?.mayaNumber || account?.bankDetails),
    },
    {
      label: "Configure reminders",
      description: "Choose which channels (SMS, email, in-app) send payment reminders and when.",
      href: "/dashboard/reminders",
      done: !!reminderConfig,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{getMonthLabel(currentMonth)} Overview</p>
      </div>

      <GettingStarted steps={gettingStartedSteps} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Collected" value={collected} icon={CheckCircle} isCurrency variant="success" trend={`${collectedCount} payments`} />
        <StatCard title="Pending" value={pending} icon={Clock} isCurrency variant="warning" trend={`${pendingRows.length} tenants`} />
        <StatCard title="Overdue" value={overdue} icon={AlertTriangle} isCurrency variant="danger" trend={`${overdueRows.length} tenants`} />
        <StatCard title="Total Units" value={totalUnits} icon={Home} />
        <StatCard title="Occupied" value={occupiedUnits} icon={Users} variant="success" trend={`${vacantUnits} vacant`} />
        <StatCard title="Active Tenants" value={tenants.length} icon={Users} variant="default" />
      </div>

      {/* Recent Payments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Payments</h2>
          <Link href="/dashboard/payments" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tenant</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Unit</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentPayments.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8">No payments this month</td></tr>
              )}
              {recentPayments.map((p) => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{p.tenant.name}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {p.tenant.unit.property.name} – {p.tenant.unit.unitNumber}
                  </td>
                  <td className="px-4 py-3 text-white">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell capitalize">{p.method ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unpaid / Pending / Overdue Tenants */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Who Hasn&apos;t Paid</h2>
          <span className="text-sm text-gray-500">{unpaidRows.length} tenant{unpaidRows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
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
              {unpaidRows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8">Everyone&apos;s paid up 🎉</td></tr>
              )}
              {unpaidRows.map((r) => (
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
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/properties", label: "Add Property", icon: Home },
          { href: "/dashboard/tenants", label: "Add Tenant", icon: Users },
          { href: "/dashboard/payments", label: "Record Payment", icon: DollarSign },
          { href: "/dashboard/reminders", label: "Reminders", icon: Clock },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors text-center"
          >
            <Icon className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-gray-300">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
