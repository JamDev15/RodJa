import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { leadStatusLabel } from "@/lib/workflow-meta";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const accounts = await prisma.account.findMany({
    include: { plan: true, billingRecords: { where: { status: "paid" }, select: { id: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const header = ["Signed up", "Name", "Business", "Email", "Phone", "Social media", "Wants onboarding call", "Lead status", "Plan", "Trial ends", "Paying", "Active", "Unsubscribed", "Notes"];
  const rows = accounts.map((a) => [
    a.createdAt.toISOString(),
    a.ownerName,
    a.name,
    a.email,
    a.phone,
    a.socialMedia,
    a.wantsOnboardingCall == null ? "" : a.wantsOnboardingCall ? "Yes" : "No",
    leadStatusLabel(a.leadStatus),
    a.plan.name,
    a.trialEndsAt?.toISOString() ?? "",
    a.billingRecords.length > 0 || a.lifetimeAccess ? "Yes" : "No",
    a.isActive ? "Yes" : "No",
    a.marketingOptOut ? "Yes" : "No",
    a.leadNotes,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tenanthub-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
