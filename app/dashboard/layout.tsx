import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { AssistantWidget } from "@/components/dashboard/assistant-widget";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !["LANDLORD", "STAFF"].includes(user?.role)) {
    redirect("/login");
  }

  // Chat Assistant is a Pro-plan perk.
  let isPro = false;
  if (user.role === "LANDLORD" && user.accountId) {
    const account = await prisma.account.findUnique({ where: { id: user.accountId }, select: { plan: { select: { name: true } } } });
    isPro = account?.plan.name === "Pro";
  }

  return (
    <div className="flex h-screen bg-[#080c14]">
      <Sidebar accountName={user?.accountName} />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      {isPro && <AssistantWidget />}
    </div>
  );
}
