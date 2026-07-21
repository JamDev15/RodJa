import { prisma } from "@/lib/prisma";
import { formatCurrency, getCurrentMonth } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Users, Building2, CreditCard, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const currentMonth = getCurrentMonth();

  const [totalAccounts, activeAccounts, totalProperties, totalTenants, billingThisMonth] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { isActive: true } }),
    prisma.property.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.billingRecord.findMany({ where: { period: currentMonth } }),
  ]);

  const mrr = billingThisMonth.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const pendingBilling = billingThisMonth.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount, 0);

  const recentAccounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { plan: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Overview of all accounts and activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Accounts" value={totalAccounts} icon={Users} trend={`${activeAccounts} active`} />
        <StatCard title="Properties" value={totalProperties} icon={Building2} />
        <StatCard title="Active Tenants" value={totalTenants} icon={Users} variant="success" />
        <StatCard title="MRR" value={mrr} icon={TrendingUp} isCurrency variant="success" trend={`₱${pendingBilling.toLocaleString()} pending`} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Recent Accounts</h2>
          <Link href="/admin/accounts" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Account</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {recentAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/admin/accounts/${a.id}`} className="font-medium text-white hover:text-purple-400">
                      {a.name}
                    </Link>
                    <p className="text-xs text-gray-500">{a.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.plan.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.isActive ? "success" : "destructive"}>
                      {a.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
