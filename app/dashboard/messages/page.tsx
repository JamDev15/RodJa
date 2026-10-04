import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { MessageHistoryList, CATEGORY_LABELS } from "@/components/dashboard/message-history";

const PAGE_SIZE = 50;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000);
}

const selectClass =
  "min-w-0 flex-1 rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink focus:border-th-accent focus:outline-none sm:flex-none";

export default async function MessageHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; channel?: string; status?: string; category?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;
  const page = Math.max(1, Number(sp.page) || 1);

  // Owners see everything sent to their tenants and to themselves — but not
  // the platform's internal admin/lead mail about their account.
  const where: Prisma.MessageLogWhereInput = {
    accountId,
    recipientType: { in: ["tenant", "owner"] },
  };
  if (sp.to === "tenant" || sp.to === "owner") where.recipientType = sp.to;
  if (sp.channel) where.channel = sp.channel;
  if (sp.status) where.status = sp.status;
  if (sp.category) where.category = sp.category;
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { recipientName: { contains: q, mode: "insensitive" } },
      { to: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ];
  }

  const since30 = daysAgo(30);
  const [messages, total, sent30, failed30] = await Promise.all([
    prisma.messageLog.findMany({
      where,
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.messageLog.count({ where }),
    prisma.messageLog.count({ where: { accountId, recipientType: { in: ["tenant", "owner"] }, status: "sent", createdAt: { gte: since30 } } }),
    prisma.messageLog.count({ where: { accountId, recipientType: { in: ["tenant", "owner"] }, status: "failed", createdAt: { gte: since30 } } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(sp).forEach(([k, v]) => v && k !== "page" && params.set(k, v));
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-th-ink">Message History</h1>
        <p className="text-th-muted text-sm">
          Every reminder, invoice, receipt, contract, and automation sent to your tenants and to you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-th-line bg-th-surface p-4">
          <p className="text-xs text-th-faint">Sent (30 days)</p>
          <p className="text-2xl font-bold text-th-ink">{sent30}</p>
        </div>
        <div className="rounded-xl border border-th-line bg-th-surface p-4">
          <p className="text-xs text-th-faint">Failed (30 days)</p>
          <p className={`text-2xl font-bold ${failed30 > 0 ? "text-th-danger" : "text-th-ink"}`}>{failed30}</p>
        </div>
        <Link
          href="/dashboard/automations"
          className="col-span-2 sm:col-span-1 rounded-xl border border-th-accent/30 bg-th-brand-soft p-4 hover:bg-th-brand-soft transition-colors"
        >
          <p className="text-xs text-th-accent">Want more reminders?</p>
          <p className="text-sm font-semibold text-th-ink mt-1">Set up automations →</p>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, email, phone, text…"
          className={`${selectClass} sm:w-64`}
        />
        <select name="to" defaultValue={sp.to ?? ""} className={selectClass}>
          <option value="">Tenants & owner</option>
          <option value="tenant">Tenants only</option>
          <option value="owner">Me (owner) only</option>
        </select>
        <select name="channel" defaultValue={sp.channel ?? ""} className={selectClass}>
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="push">Push</option>
          <option value="in_app">In-app</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ""} className={selectClass}>
          <option value="">All types</option>
          {["reminder", "bill_reminder", "automation", "workflow", "invoice", "receipt", "contract", "billing", "report"].map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={selectClass}>
          <option value="">Any status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <button type="submit" className="rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">Filter</button>
      </form>

      <p className="text-xs text-th-faint">{total} message{total === 1 ? "" : "s"}</p>
      <MessageHistoryList messages={messages} />

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={qs(page - 1)} className="text-th-accent hover:text-th-accent">← Newer</Link> : <span />}
          <span className="text-th-faint">Page {page} of {pages}</span>
          {page < pages ? <Link href={qs(page + 1)} className="text-th-accent hover:text-th-accent">Older →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
