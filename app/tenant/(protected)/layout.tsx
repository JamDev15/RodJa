import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TenantNav } from "@/components/tenant/tenant-nav";

export default async function TenantProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || user?.role !== "TENANT") {
    redirect("/tenant/login");
  }

  return (
    <div className="min-h-screen bg-[#080c14]">
      <TenantNav tenantName={user?.name} />
      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
