import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TenantNav } from "@/components/tenant/tenant-nav";
import { prisma } from "@/lib/prisma";

// Private app area — keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TenantProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || user?.role !== "TENANT") {
    redirect("/tenant/login");
  }

  const billing = await prisma.billingProfile.findFirst({
    where: { enabled: true, property: { units: { some: { tenants: { some: { id: user.tenantId } } } } } },
    select: { id: true },
  });

  // Office replies not yet read, for the Messages badge.
  const threads = await prisma.messageThread.findMany({ where: { tenantId: user.tenantId, lastSenderRole: "ADMIN" }, select: { lastMessageAt: true, tenantReadAt: true } });
  const unread = threads.filter((t) => !t.tenantReadAt || t.tenantReadAt < t.lastMessageAt).length;

  return (
    <div className="min-h-screen bg-th-canvas">
      <TenantNav tenantName={user?.name} billingEnabled={!!billing} unreadMessages={unread} />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
