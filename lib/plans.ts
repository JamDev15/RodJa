import { prisma } from "@/lib/prisma";

/** TenantHub sells one plan: Pro at ₱499/month, with a 3-day free trial. */
export const SUBSCRIPTION_PRICE = 499;
export const TRIAL_DAYS = 3;
export const PLAN_NAME = "Pro";

const DEFAULT_PLANS = [
  { name: "Free", price: 0, maxUnits: 3, maxTenants: 20, maxProperties: 1, features: { smsReminders: false, paymentProof: false, publicListings: false, maintenance: false } },
  { name: "Basic", price: 199, maxUnits: 15, maxTenants: 50, maxProperties: 3, isActive: false, features: { smsReminders: true, paymentProof: true, publicListings: false, maintenance: false } },
  { name: "Pro", price: SUBSCRIPTION_PRICE, maxUnits: -1, maxTenants: -1, maxProperties: -1, features: { smsReminders: true, paymentProof: true, publicListings: true, maintenance: true, contracts: true, invoices: true, automations: true } },
];

/** The single sellable plan, creating the default plan rows on a fresh database. */
export async function getSubscriptionPlan() {
  let plan = await prisma.plan.findFirst({ where: { name: PLAN_NAME }, orderBy: { createdAt: "asc" } });
  if (!plan) {
    await prisma.plan.createMany({ data: DEFAULT_PLANS, skipDuplicates: true });
    plan = await prisma.plan.findFirst({ where: { name: PLAN_NAME }, orderBy: { createdAt: "asc" } });
  }
  if (!plan) throw new Error("Subscription plan missing");
  return plan;
}

/** An account is "in trial" until it has made its first approved payment. */
export async function hasEverPaid(accountId: string): Promise<boolean> {
  const paid = await prisma.billingRecord.findFirst({ where: { accountId, status: "paid" }, select: { id: true } });
  return !!paid;
}
