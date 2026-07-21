import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Bell, AlertTriangle, Info } from "lucide-react";

export default async function TenantNoticesPage() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  const accountId = (session?.user as any)?.accountId;

  const notices = await prisma.notice.findMany({
    where: { OR: [{ tenantId }, { accountId, tenantId: null }] },
    orderBy: { createdAt: "desc" },
  });

  const iconMap: Record<string, any> = {
    urgent: AlertTriangle,
    payment: Bell,
    general: Info,
    maintenance: Info,
  };

  const colorMap: Record<string, string> = {
    urgent: "text-red-400 bg-red-400/10",
    payment: "text-yellow-400 bg-yellow-400/10",
    general: "text-blue-400 bg-blue-400/10",
    maintenance: "text-orange-400 bg-orange-400/10",
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white">Notices</h1>
        <p className="text-gray-400 text-sm">Announcements from your landlord</p>
      </div>

      {notices.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="h-12 w-12 text-gray-600 mb-3" />
          <p className="text-gray-400">No notices yet</p>
        </div>
      )}

      <div className="space-y-3">
        {notices.map((notice) => {
          const Icon = iconMap[notice.type] ?? Info;
          const color = colorMap[notice.type] ?? "text-blue-400 bg-blue-400/10";
          return (
            <div key={notice.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${color} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{notice.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(notice.createdAt)}</p>
                  <p className="text-sm text-gray-400 mt-2">{notice.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
