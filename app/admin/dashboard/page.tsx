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
        <h1 className="text-2xl font-bold text-th-ink">Platform Dashboard</h1>
        <p className="text-th-muted text-sm mt-1">Overview of all accounts and activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Accounts" value={totalAccounts} icon={Users} trend={`${activeAccounts} active`} />
        <StatCard title="Properties" value={totalProperties} icon={Building2} />
        <StatCard title="Active Tenants" value={totalTenants} icon={Users} variant="success" />
        <StatCard title="MRR" value={mrr} icon={TrendingUp} isCurrency variant="success" trend={`₱${pendingBilling.toLocaleString()} pending`} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-th-ink">Recent Accounts</h2>
          <Link href="/admin/accounts" className="text-sm text-th-accent hover:text-th-accent">View all →</Link>
        </div>
        <div className="rounded-xl border border-th-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface">
                <th className="text-left px-4 py-3 text-th-muted font-medium">Account</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-line">
              {recentAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-th-raised">
                  <td className="px-4 py-3">
                    <Link href={`/admin/accounts/${a.id}`} className="font-medium text-th-ink hover:text-th-violet">
                      {a.name}
                    </Link>
                    <p className="text-xs text-th-faint">{a.email}</p>
                  </td>
                  <td className="px-4 py-3 text-th-muted">{a.plan.name}</td>
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
