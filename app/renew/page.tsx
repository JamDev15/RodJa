import type { Metadata } from "next";
import { AuthShell, Notice } from "@/components/public/ui";
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

  const footer = <p>Questions? Reply to any TenantHub email and we&apos;ll help you out.</p>;

  if (!accountId) {
    return (
      <AuthShell
        title={<>Reactivate your <em>account.</em></>}
        subtitle="Sign in to continue your TenantHub subscription. All your data is still here."
        footer={footer}
      >
        {token && <div className="mb-5"><Notice tone="info">That link has expired. Sign in to get a fresh one.</Notice></div>}
        <RenewLogin />
      </AuthShell>
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
  if (!account) {
    return (
      <AuthShell title="Account not found" footer={footer}>
        <p className="text-[15px] text-th-muted">We couldn&apos;t find that account. Try signing in again from the renew page.</p>
      </AuthShell>
    );
  }

  const latest = account.billingRecords[0];
  const amount = account.plan.price > 0 && latest && latest.status !== "paid" ? latest.amount : plan.price;
  const awaiting = latest?.status === "submitted";
  const trialEnded = reason === "trial_ended" || (!!account.trialEndsAt && account.trialEndsAt <= new Date() && latest?.status !== "paid");

  return (
    <AuthShell
      title={
        awaiting ? <>Payment under <em>review.</em></> : trialEnded ? <>Your free trial <em>has ended.</em></> : <>Your account <em>is paused.</em></>
      }
      subtitle={
        awaiting
          ? "We received your reference number. You'll get an email with a login link as soon as it's approved."
          : `Hi ${account.ownerName}. Subscribe for ${formatCurrency(amount)}/month to pick up where you left off — your properties, tenants, and records are all saved.`
      }
      footer={footer}
    >
      {awaiting ? (
        <Notice tone="success">Payment received for review. Approval usually takes less than a day.</Notice>
      ) : (
        <RenewForm
          token={token!}
          amount={amount}
          gcashNumber={settings?.gcashNumber ?? null}
          gcashQrUrl={settings?.gcashQrUrl ?? null}
          mayaNumber={settings?.mayaNumber ?? null}
          mayaQrUrl={settings?.mayaQrUrl ?? null}
        />
      )}
    </AuthShell>
  );
}
