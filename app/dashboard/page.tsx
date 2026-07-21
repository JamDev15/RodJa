import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, getMonthLabel, getCurrentMonth } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { DollarSign, Home, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  const currentMonth = getCurrentMonth();

  const [properties, allPayments, tenants] = await Promise.all([
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
    }),
  ]);

  const allUnits = properties.flatMap((p) => p.units);
  const totalUnits = allUnits.length;
  const occupiedUnits = allUnits.filter((u) => u.status === "occupied").length;
  const vacantUnits = allUnits.filter((u) => u.status === "vacant").length;

  const collected = allPayments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pending = allPayments.filter((p) => ["pending", "submitted"].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const overdue = allPayments.filter((p) => p.status === "late").reduce((s, p) => s + p.amount, 0);

  const recentPayments = allPayments.slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">{getMonthLabel(currentMonth)} Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Collected" value={collected} icon={CheckCircle} isCurrency variant="success" trend={`${allPayments.filter(p => p.status === "approved").length} payments`} />
        <StatCard title="Pending" value={pending} icon={Clock} isCurrency variant="warning" trend={`${allPayments.filter(p => ["pending","submitted"].includes(p.status)).length} payments`} />
        <StatCard title="Overdue" value={overdue} icon={AlertTriangle} isCurrency variant="danger" trend={`${allPayments.filter(p => p.status === "late").length} tenants`} />
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
