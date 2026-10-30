import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";

// Private app area — keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh bg-th-canvas overflow-x-hidden">
      <AdminNav />
      <main className="flex-1 min-w-0 pt-appbar lg:pt-0 lg:ml-64 overflow-y-auto overflow-x-hidden">
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:p-8">{children}</div>
      </main>
    </div>
  );
}
