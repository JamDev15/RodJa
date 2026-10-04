import Link from "next/link";
import { Mail, MessageSquare, Bell, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import type { MessageLog } from "@prisma/client";

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail; className: string }> = {
  email: { label: "Email", icon: Mail, className: "text-blue-400 bg-blue-500/10" },
  sms: { label: "SMS", icon: MessageSquare, className: "text-emerald-400 bg-emerald-500/10" },
  push: { label: "Push", icon: Smartphone, className: "text-purple-400 bg-purple-500/10" },
  in_app: { label: "In-app", icon: Bell, className: "text-amber-400 bg-amber-500/10" },
};

export const CATEGORY_LABELS: Record<string, string> = {
  reminder: "Rent reminder",
  bill_reminder: "Bill reminder",
  automation: "Automation",
  invoice: "Invoice",
  receipt: "Receipt",
  contract: "Contract",
  billing: "Subscription",
  trial: "Trial",
  welcome: "Welcome",
  workflow: "Workflow",
  report: "Monthly report",
  system: "System",
};

const RECIPIENT_LABELS: Record<string, string> = {
  tenant: "Tenant",
  owner: "Owner",
  admin: "Admin",
  lead: "Signup",
};

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(d);
}

type Row = MessageLog & { tenant?: { id: string; name: string } | null };

/**
 * Read-only list of logged messages. Each row expands (native <details>, no
 * client JS) to show the full text that went out and any delivery error.
 */
export function MessageHistoryList({
  messages,
  showTenantLink = true,
  emptyText = "No messages yet. Reminders, invoices, receipts, and contracts you send will show up here.",
}: {
  messages: Row[];
  showTenantLink?: boolean;
  emptyText?: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">{emptyText}</div>
    );
  }

  return (
    <ul className="divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
      {messages.map((m) => {
        const channel = CHANNEL_META[m.channel] ?? CHANNEL_META.email;
        const Icon = channel.icon;
        const failed = m.status === "failed";
        return (
          <li key={m.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-white/5 [&::-webkit-details-marker]:hidden">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${channel.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-white">
                      {m.subject || m.body.split("\n")[0].slice(0, 90)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-gray-400">
                      {RECIPIENT_LABELS[m.recipientType] ?? m.recipientType}
                    </span>
                    <span className="text-gray-300">{m.recipientName ?? "—"}</span>
                    {m.to && <span className="truncate">· {m.to}</span>}
                    <span>· {CATEGORY_LABELS[m.category] ?? m.category}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatWhen(m.createdAt)}</span>
                  {failed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3 w-3" />Failed</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3 w-3" />Sent</span>
                  )}
                </div>
              </summary>
              <div className="border-t border-white/5 bg-black/20 px-4 py-3 text-sm sm:pl-15">
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Channel: <span className="text-gray-300">{channel.label}</span></span>
                  {m.to && <span>To: <span className="text-gray-300">{m.to}</span></span>}
                  {showTenantLink && m.tenant && (
                    <Link href={`/dashboard/tenants/${m.tenant.id}`} className="text-blue-400 hover:text-blue-300">
                      View tenant →
                    </Link>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-gray-300">{m.body}</p>
                {failed && m.error && (
                  <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">Error: {m.error}</p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
