import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { AssistantWidget } from "@/components/dashboard/assistant-widget";
import { getAccessState } from "@/lib/access";
import { createSignedToken } from "@/lib/tokens";

// Private app area — keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !["LANDLORD", "STAFF"].includes(user?.role)) {
    redirect("/login");
  }

  // Expired trial or paused subscription → straight to the reactivation page.
  if (user.accountId) {
    const state = await getAccessState(user.accountId);
    if (state !== "ok") {
      redirect(`/renew?token=${createSignedToken("renew", user.accountId, 1)}&reason=${state}`);
    }
  }

  // Chat Assistant is a Pro-plan perk.
  let isPro = false;
  if (user.role === "LANDLORD" && user.accountId) {
    const account = await prisma.account.findUnique({ where: { id: user.accountId }, select: { plan: { select: { name: true } } } });
    isPro = account?.plan.name === "Pro";
  }

  return (
    <div className="flex h-screen bg-[#080c14] overflow-x-hidden">
      <Sidebar accountName={user?.accountName} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:ml-64 overflow-y-auto overflow-x-hidden">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
      {isPro && <AssistantWidget />}
    </div>
  );
}
