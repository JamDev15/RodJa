import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { daysBetween } from "@/lib/due-dates";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { BillingPayForm } from "./billing-pay-form";
import { UpgradeButton } from "./upgrade-button";

const PLAN_FEATURES: Record<string, string[]> = {
  Free: ["Manual tracking", "Tenant portal", "7-day trial only"],
  Basic: ["SMS reminders", "Payment proof", "Email support"],
  Pro: ["Unlimited everything", "Public listings", "Maintenance module", "PDF/CSV export"],
};

export default async function BillingPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const [account, plans] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      include: { plan: true, billingRecords: { orderBy: { createdAt: "desc" }, take: 6 } },
    }),
    prisma.plan.findMany({ where: { isActive: true, price: { gt: 0 } }, orderBy: { price: "asc" } }),
  ]);

  const trialDaysLeft = account?.plan.price === 0 && account.trialEndsAt
    ? daysBetween(account.trialEndsAt, new Date())
    : null;

  const stats = await prisma.$transaction([
    prisma.property.count({ where: { accountId } }),
    prisma.unit.count({ where: { property: { accountId } } }),
    prisma.tenant.count({ where: { isActive: true, unit: { property: { accountId } } } }),
  ]);

  const [propCount, unitCount, tenantCount] = stats;

  const currentBill = account?.billingRecords.find((b) => b.status === "pending" || b.status === "submitted" || b.status === "overdue");
  const platformSettings = currentBill ? await prisma.platformSettings.findFirst() : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Plan</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your subscription</p>
      </div>

      {trialDaysLeft !== null && (
        <div className={`rounded-xl border p-4 text-sm ${trialDaysLeft <= 0 ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>
          {trialDaysLeft <= 0
            ? "Your 7-day free trial has ended. Upgrade to Basic or Pro below to keep using TenantHub."
            : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}. Upgrade anytime to avoid interruption.`}
        </div>
      )}

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

      {/* Pay Now */}
      {currentBill && (
        <div className={`rounded-xl border p-6 ${currentBill.status === "overdue" ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/30 bg-yellow-500/10"}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {currentBill.status === "overdue" ? "Account Paused — Payment Overdue" : "Subscription Payment Due"}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {currentBill.period} · {formatCurrency(currentBill.amount)} · Due {formatDate(currentBill.dueDate)}
              </p>
              {currentBill.status === "submitted" && (
                <p className="text-sm text-blue-400 mt-1">Submitted — awaiting approval.</p>
              )}
            </div>
            <Badge variant={currentBill.status === "overdue" ? "destructive" : "warning"}>{currentBill.status}</Badge>
          </div>

          {currentBill.status !== "submitted" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {platformSettings?.gcashNumber && (
                  <div>
                    <p className="text-xs text-gray-500">GCash</p>
                    <p className="text-white font-medium">{platformSettings.gcashNumber}</p>
                    {platformSettings.gcashQrUrl && (
                      <img src={platformSettings.gcashQrUrl} alt="GCash QR" className="mt-2 h-40 w-40 rounded-lg border border-white/10 object-contain bg-white" />
                    )}
                  </div>
                )}
                {platformSettings?.mayaNumber && (
                  <div>
                    <p className="text-xs text-gray-500">Maya</p>
                    <p className="text-white font-medium">{platformSettings.mayaNumber}</p>
                    {platformSettings.mayaQrUrl && (
                      <img src={platformSettings.mayaQrUrl} alt="Maya QR" className="mt-2 h-40 w-40 rounded-lg border border-white/10 object-contain bg-white" />
                    )}
                  </div>
                )}
                {!platformSettings?.gcashNumber && !platformSettings?.mayaNumber && (
                  <p className="text-sm text-gray-500">Payment details haven&apos;t been set up yet — contact support.</p>
                )}
              </div>
              <BillingPayForm />
            </div>
          )}
        </div>
      )}

      {/* Upgrade */}
      {!currentBill && account?.plan.name !== "Pro" && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Upgrade Plan</h2>
          <p className="text-sm text-gray-400 mb-3">
            Basic and Pro have no free trial — pay to activate, then it&apos;s active as soon as we approve your payment.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const isCurrent = plan.name === account?.plan.name;
              return (
                <div key={plan.id} className={`rounded-xl border p-5 ${isCurrent ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"} transition-colors`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-white mb-3">
                    ₱{plan.price}<span className="text-sm font-normal text-gray-400">/mo</span>
                  </p>
                  <ul className="space-y-1 mb-4">
                    {(PLAN_FEATURES[plan.name] ?? []).map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && <UpgradeButton planId={plan.id} label={`Upgrade to ${plan.name}`} />}
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
