import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { AssistantWidget } from "@/components/dashboard/assistant-widget";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !["LANDLORD", "STAFF"].includes(user?.role)) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-[#080c14]">
      <Sidebar accountName={user?.accountName} />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      {user?.role === "LANDLORD" && <AssistantWidget />}
    </div>
  );
}
