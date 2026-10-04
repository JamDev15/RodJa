import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
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
    urgent: "text-th-danger bg-th-danger-soft",
    payment: "text-th-due bg-th-due-soft",
    general: "text-th-accent bg-th-brand-soft",
    maintenance: "text-th-due bg-th-due-soft",
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-th-ink">Notices</h1>
        <p className="text-th-muted text-sm">Announcements from your landlord</p>
      </div>

      {notices.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="h-12 w-12 text-th-faint mb-3" />
          <p className="text-th-muted">No notices yet</p>
        </div>
      )}

      <div className="space-y-3">
        {notices.map((notice) => {
          const Icon = iconMap[notice.type] ?? Info;
          const color = colorMap[notice.type] ?? "text-th-accent bg-th-brand-soft";
          return (
            <div key={notice.id} className="rounded-xl border border-th-line bg-th-surface p-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${color} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-th-ink">{notice.title}</p>
                  <p className="text-xs text-th-faint mt-0.5">{formatDate(notice.createdAt)}</p>
                  <p className="text-sm text-th-muted mt-2 whitespace-pre-wrap">{notice.content}</p>
                  {["contract", "invoice", "receipt"].includes(notice.type) && (
                    <Link href="/tenant/documents" className="mt-2 inline-block text-sm text-th-accent hover:text-th-accent">Open Documents →</Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
