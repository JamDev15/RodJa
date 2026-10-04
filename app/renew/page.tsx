import type { Metadata } from "next";
import Link from "next/link";
import { Home } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/tokens";
import { getSubscriptionPlan } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";
import { RenewForm, RenewLogin } from "./renew-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reactivate your account",
  robots: { index: false, follow: false },
};

export default async function RenewPage({ searchParams }: { searchParams: Promise<{ token?: string; reason?: string }> }) {
  const { token, reason } = await searchParams;
  const accountId = token ? verifySignedToken("renew", token) : null;

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 mb-4">
            <Home className="h-5 w-5 text-white" />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );

  if (!accountId) {
    return shell(
      <>
        <h1 className="text-2xl font-bold text-white">Reactivate your account</h1>
        <p className="text-gray-400 text-sm mt-1 mb-6">Sign in to continue your TenantHub subscription. All your data is still here.</p>
        {token && <p className="mb-4 text-sm text-yellow-400">That link has expired — sign in to get a fresh one.</p>}
        <RenewLogin />
      </>
    );
  }

  const [account, plan, settings] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      include: { plan: true, billingRecords: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    getSubscriptionPlan(),
    prisma.platformSettings.findFirst(),
  ]);
  if (!account) return shell(<p className="text-gray-400">Account not found.</p>);

  const latest = account.billingRecords[0];
  const amount = account.plan.price > 0 && latest && latest.status !== "paid" ? latest.amount : plan.price;
  const awaiting = latest?.status === "submitted";
  const trialEnded = reason === "trial_ended" || (!!account.trialEndsAt && account.trialEndsAt <= new Date() && latest?.status !== "paid");

  return shell(
    <>
      <h1 className="text-2xl font-bold text-white">
        {awaiting ? "Payment under review" : trialEnded ? "Your free trial has ended" : "Your account is paused"}
      </h1>
      <p className="text-gray-400 text-sm mt-1">
        {awaiting
          ? "We received your reference number. You'll get an email with a login link as soon as it's approved."
          : `Hi ${account.ownerName}! Subscribe for ${formatCurrency(amount)}/month to pick up right where you left off — your properties, tenants, and records are all saved.`}
      </p>
      {!awaiting && (
        <div className="mt-6 text-left">
          <RenewForm
            token={token!}
            amount={amount}
            gcashNumber={settings?.gcashNumber ?? null}
            gcashQrUrl={settings?.gcashQrUrl ?? null}
            mayaNumber={settings?.mayaNumber ?? null}
            mayaQrUrl={settings?.mayaQrUrl ?? null}
          />
        </div>
      )}
      <p className="mt-6 text-xs text-gray-500">
        Questions? Reply to any TenantHub email and we&apos;ll help you out.
      </p>
    </>
  );
}
