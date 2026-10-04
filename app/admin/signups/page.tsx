import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, Workflow } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES } from "@/lib/workflow-meta";
import { SignupsTable, type SignupRow } from "./signups-table";

const selectClass =
  "min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-white focus:border-purple-500 focus:outline-none sm:flex-none";

function trialState(a: { lifetimeAccess: boolean; isActive: boolean; trialEndsAt: Date | null; paid: boolean }, now: Date) {
  if (a.lifetimeAccess) return { label: "Lifetime", tone: "green" as const };
  if (a.paid) return { label: a.isActive ? "Paying" : "Paused (unpaid)", tone: a.isActive ? ("green" as const) : ("red" as const) };
  if (!a.trialEndsAt) return { label: a.isActive ? "Active" : "Paused", tone: a.isActive ? ("gray" as const) : ("red" as const) };
  const ms = a.trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return { label: "Trial expired", tone: "red" as const };
  const hours = Math.ceil(ms / 3600000);
  return { label: hours <= 24 ? `Trial · ${hours}h left` : `Trial · ${Math.ceil(hours / 24)}d left`, tone: hours <= 24 ? ("amber" as const) : ("blue" as const) };
}

export default async function AdminSignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; call?: string; trial?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();

  const where: Prisma.AccountWhereInput = {};
  if (sp.status) where.leadStatus = sp.status;
  if (sp.call === "yes") where.wantsOnboardingCall = true;
  if (sp.call === "no") where.wantsOnboardingCall = false;
  if (sp.trial === "active") Object.assign(where, { trialEndsAt: { gt: now }, billingRecords: { none: { status: "paid" } }, lifetimeAccess: false });
  if (sp.trial === "expired") Object.assign(where, { trialEndsAt: { lte: now }, billingRecords: { none: { status: "paid" } }, lifetimeAccess: false });
  if (sp.trial === "paying") where.OR = [{ lifetimeAccess: true }, { billingRecords: { some: { status: "paid" } } }];
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    const search: Prisma.AccountWhereInput[] = [
      { ownerName: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { socialMedia: { contains: q, mode: "insensitive" } },
    ];
    where.AND = [{ OR: search }];
  }

  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const in24h = new Date(now.getTime() + 86400000);
  const [accounts, workflows, newThisWeek, callRequests, expiringSoon, converted] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        plan: { select: { name: true } },
        billingRecords: { where: { status: "paid" }, select: { id: true }, take: 1 },
        workflowEnrollments: { where: { status: "active" }, include: { workflow: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.workflow.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.account.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.account.count({ where: { wantsOnboardingCall: true, leadStatus: { in: ["new", "interested"] } } }),
    prisma.account.count({ where: { trialEndsAt: { gt: now, lte: in24h }, billingRecords: { none: { status: "paid" } }, lifetimeAccess: false } }),
    prisma.account.count({ where: { OR: [{ leadStatus: "converted" }, { billingRecords: { some: { status: "paid" } } }] } }),
  ]);

  const rows: SignupRow[] = accounts.map((a) => {
    const state = trialState({ lifetimeAccess: a.lifetimeAccess, isActive: a.isActive, trialEndsAt: a.trialEndsAt, paid: a.billingRecords.length > 0 }, now);
    return {
      id: a.id,
      ownerName: a.ownerName,
      business: a.name,
      email: a.email,
      phone: a.phone,
      socialMedia: a.socialMedia,
      wantsOnboardingCall: a.wantsOnboardingCall,
      leadStatus: a.leadStatus,
      leadNotes: a.leadNotes,
      createdAt: a.createdAt.toISOString(),
      trialLabel: state.label,
      trialTone: state.tone,
      marketingOptOut: a.marketingOptOut,
      workflows: a.workflowEnrollments.map((e) => e.workflow.name),
    };
  });

  const stats = [
    { label: "New this week", value: newThisWeek },
    { label: "Want a call", value: callRequests, href: "?call=yes" },
    { label: "Trials ending in 24h", value: expiringSoon, href: "?trial=active" },
    { label: "Paying customers", value: converted, href: "?trial=paying" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signups</h1>
          <p className="text-gray-400 text-sm mt-1">Everyone who signed up, with their contact details and onboarding preference.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/workflows" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10">
            <Workflow className="h-4 w-4" /> Workflows
          </Link>
          {/* Plain <a>: this is a file download from an API route, not a page navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/signups/export" download className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) =>
          s.href ? (
            <Link key={s.label} href={s.href} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.08]">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          )
        )}
      </div>

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email, phone, social…" className={`${selectClass} sm:w-64`} />
        <select name="status" defaultValue={sp.status ?? ""} className={selectClass}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select name="call" defaultValue={sp.call ?? ""} className={selectClass}>
          <option value="">Call: any</option>
          <option value="yes">Wants a call</option>
          <option value="no">No call</option>
        </select>
        <select name="trial" defaultValue={sp.trial ?? ""} className={selectClass}>
          <option value="">Any subscription</option>
          <option value="active">In trial</option>
          <option value="expired">Trial expired</option>
          <option value="paying">Paying</option>
        </select>
        <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">Filter</button>
      </form>

      <SignupsTable rows={rows} workflows={workflows} />
    </div>
  );
}
