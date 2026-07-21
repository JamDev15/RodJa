import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CheckCircle, Zap } from "lucide-react";

const PLANS = [
  { name: "Free", price: 0, maxProperties: 1, maxUnits: 3, maxTenants: 20, features: ["Manual tracking", "Tenant portal"] },
  { name: "Basic", price: 199, maxProperties: 3, maxUnits: 15, maxTenants: 50, features: ["SMS reminders", "Payment proof", "Email support"] },
  { name: "Pro", price: 499, maxProperties: -1, maxUnits: -1, maxTenants: -1, features: ["Unlimited everything", "Public listings", "Maintenance module", "PDF/CSV export"] },
];

export default async function BillingPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { plan: true, billingRecords: { orderBy: { createdAt: "desc" }, take: 6 } },
  });

  const stats = await prisma.$transaction([
    prisma.property.count({ where: { accountId } }),
    prisma.unit.count({ where: { property: { accountId } } }),
    prisma.tenant.count({ where: { isActive: true, unit: { property: { accountId } } } }),
  ]);

  const [propCount, unitCount, tenantCount] = stats;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your subscription</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide">Current Plan</p>
            <h2 className="text-2xl font-bold text-white mt-1">{account?.plan.name}</h2>
          </div>
          <Badge variant="default" className="text-sm px-3 py-1">
            {account?.plan.price === 0 ? "Free" : `₱${account?.plan.price}/mo`}
          </Badge>
        </div>

        {/* Usage */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Properties", used: propCount, max: account?.plan.maxProperties },
            { label: "Units", used: unitCount, max: account?.plan.maxUnits },
            { label: "Tenants", used: tenantCount, max: account?.plan.maxTenants },
          ].map(({ label, used, max }) => (
            <div key={label} className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-white">
                {used}
                <span className="text-sm font-normal text-gray-400">/{max === -1 ? "∞" : max}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade */}
      {account?.plan.name !== "Pro" && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Upgrade Plan</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.name === account?.plan.name;
              return (
                <div key={plan.name} className={`rounded-xl border p-5 ${isCurrent ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"} transition-colors`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-white mb-3">
                    {plan.price === 0 ? "Free" : `₱${plan.price}`}
                    {plan.price > 0 && <span className="text-sm font-normal text-gray-400">/mo</span>}
                  </p>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && plan.price > 0 && (
                    <Link
                      href="/dashboard/billing/upgrade"
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Upgrade
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Billing History */}
      {account?.billingRecords && account.billingRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Billing History</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Period</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {account.billingRecords.map((b) => (
                  <tr key={b.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{b.period}</td>
                    <td className="px-4 py-3 text-white">{formatCurrency(b.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.status === "paid" ? "success" : b.status === "overdue" ? "destructive" : "warning"}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{b.paidAt ? formatDate(b.paidAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
