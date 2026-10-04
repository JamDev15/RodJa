import Link from "next/link";
import { Mail, MessageSquare, Bell, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import type { MessageLog } from "@prisma/client";

const CHANNEL_META: Record<string, { label: string; icon: typeof Mail; className: string }> = {
  email: { label: "Email", icon: Mail, className: "text-th-accent bg-th-brand-soft" },
  sms: { label: "SMS", icon: MessageSquare, className: "text-th-paid bg-th-paid-soft" },
  push: { label: "Push", icon: Smartphone, className: "text-th-violet bg-th-violet-soft" },
  in_app: { label: "In-app", icon: Bell, className: "text-th-due bg-th-due-soft" },
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
      <div className="rounded-xl border border-dashed border-th-line p-8 text-center text-sm text-th-faint">{emptyText}</div>
    );
  }

  return (
    <ul className="divide-y divide-th-line rounded-xl border border-th-line overflow-hidden">
      {messages.map((m) => {
        const channel = CHANNEL_META[m.channel] ?? CHANNEL_META.email;
        const Icon = channel.icon;
        const failed = m.status === "failed";
        return (
          <li key={m.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-th-raised [&::-webkit-details-marker]:hidden">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${channel.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-th-ink">
                      {m.subject || m.body.split("\n")[0].slice(0, 90)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-th-faint">
                    <span className="rounded bg-th-surface px-1.5 py-0.5 text-th-muted">
                      {RECIPIENT_LABELS[m.recipientType] ?? m.recipientType}
                    </span>
                    <span className="text-th-ink/80">{m.recipientName ?? "—"}</span>
                    {m.to && <span className="truncate">· {m.to}</span>}
                    <span>· {CATEGORY_LABELS[m.category] ?? m.category}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-th-faint whitespace-nowrap">{formatWhen(m.createdAt)}</span>
                  {failed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-th-danger"><XCircle className="h-3 w-3" />Failed</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-th-paid"><CheckCircle2 className="h-3 w-3" />Sent</span>
                  )}
                </div>
              </summary>
              <div className="border-t border-th-line bg-black/20 px-4 py-3 text-sm sm:pl-15">
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-th-faint">
                  <span>Channel: <span className="text-th-ink/80">{channel.label}</span></span>
                  {m.to && <span>To: <span className="text-th-ink/80">{m.to}</span></span>}
                  {showTenantLink && m.tenant && (
                    <Link href={`/dashboard/tenants/${m.tenant.id}`} className="text-th-accent hover:text-th-accent">
                      View tenant →
                    </Link>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-th-ink/80">{m.body}</p>
                {failed && m.error && (
                  <p className="mt-2 rounded-lg bg-th-danger-soft px-3 py-2 text-xs text-th-danger">Error: {m.error}</p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
