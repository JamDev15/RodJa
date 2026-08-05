import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { PlanActions } from "./plan-actions";

const FEATURE_LABELS: Record<string, string> = {
  smsReminders: "SMS Reminders",
  paymentProof: "Payment Proof Upload",
  publicListings: "Public Listings",
  maintenance: "Maintenance Module",
  exportPdf: "PDF/CSV Export",
  apiAccess: "API Access",
  whiteLabelBranding: "White-label Branding",
};

function formatLimit(n: number): string {
  return n === -1 ? "Unlimited" : String(n);
}

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { accounts: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Plans</h1>
        <p className="text-gray-400 text-sm mt-1">Subscription tiers and how many accounts are on each</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const features = (plan.features && typeof plan.features === "object" ? plan.features : {}) as Record<string, boolean>;
          return (
            <div key={plan.id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                  <p className="text-sm text-gray-400">
                    {plan.price === 0 ? "Free" : `${formatCurrency(plan.price)}/mo`}
                  </p>
                </div>
                <Badge variant={plan.isActive ? "success" : "secondary"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <p className="text-white font-semibold">{formatLimit(plan.maxProperties)}</p>
                  <p className="text-xs text-gray-500">Properties</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <p className="text-white font-semibold">{formatLimit(plan.maxUnits)}</p>
                  <p className="text-xs text-gray-500">Units</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2 text-center">
                  <p className="text-white font-semibold">{formatLimit(plan.maxTenants)}</p>
                  <p className="text-xs text-gray-500">Tenants</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(features)
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <span key={key} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                      {FEATURE_LABELS[key] ?? key}
                    </span>
                  ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <p className="text-sm text-gray-400">
                  <span className="text-white font-semibold">{plan._count.accounts}</span> account{plan._count.accounts === 1 ? "" : "s"} on this plan
                </p>
                <PlanActions planId={plan.id} isActive={plan.isActive} />
              </div>
            </div>
          );
        })}
        {plans.length === 0 && (
          <p className="text-gray-500 text-sm">No plans yet — they're created automatically on first signup.</p>
        )}
      </div>
    </div>
  );
}
