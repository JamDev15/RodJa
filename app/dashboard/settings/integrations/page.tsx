import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { ActionForm } from "@/components/collections/action-form";
import { currentActor } from "@/lib/collections/actor";
import { integrationStatus, pendingPages } from "@/lib/messenger/facebook";

const STATUS: Record<string, string> = { APPROVED: "Approved", PENDING: "Waiting for Meta", REJECTED: "Rejected by Meta", ERROR: "Couldn't be created", PAUSED: "Paused by Meta", DISABLED: "Disabled by Meta" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connect?: string; error?: string }> }) {
  const sp = await searchParams;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const [s, pages] = await Promise.all([integrationStatus(actor), sp.connect ? pendingPages(actor, sp.connect) : null]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-th-accent hover:underline">← Settings</Link>
        <h1 className="mt-2 text-2xl font-bold text-th-ink">Integrations</h1>
        <p className="text-sm text-th-muted">Connect outside services to TenantHub.</p>
      </div>

      {sp.error && <p className="rounded-lg border border-th-danger/30 bg-th-danger-soft p-3 text-sm text-th-danger" role="alert">{sp.error}</p>}

      <section className="space-y-4 rounded-xl border border-th-line bg-th-surface p-5">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-6 w-6 shrink-0 text-th-accent" />
          <div className="min-w-0">
            <h2 className="font-semibold text-th-ink">Facebook Messenger</h2>
            <p className="text-sm text-th-muted">
              Send tenants alerts through your Facebook Page — new messages, statements, payment updates and announcements — and let them reply in Messenger. You get alerts too when tenants write, pay or report repairs.
            </p>
          </div>
        </div>

        {!s.appReady ? (
          <p className="rounded-lg bg-th-raised p-3 text-sm text-th-muted">Messenger isn&apos;t available yet. TenantHub&apos;s Facebook app is still being set up — check back soon.</p>
        ) : pages ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-th-ink">Choose the Page tenants will get messages from:</p>
            <ul className="space-y-2">
              {pages.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-th-line p-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-th-ink">{p.name}</span>
                    {p.username && <span className="text-xs text-th-muted">m.me/{p.username}</span>}
                  </span>
                  <ActionForm url="/api/integrations/facebook" body={{ action: "choose", requestId: sp.connect, pageId: p.id }} submitLabel="Use this Page" redirectTo="/dashboard/settings/integrations" successMessage="Facebook Page connected" />
                </li>
              ))}
            </ul>
            <p className="text-xs text-th-faint">Don&apos;t see your Page? Connect again and tick it when Facebook asks which Pages to share. You need to be an admin of the Page.</p>
          </div>
        ) : s.page ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-th-ink">
              <CheckCircle2 className="h-4 w-4 text-th-paid" /> Connected to <strong>{s.page.pageName}</strong>
              {s.page.pageUsername && <span className="text-th-muted">(m.me/{s.page.pageUsername})</span>}
            </p>
            <p className="text-sm text-th-muted">
              {s.tenantsLinked} tenant{s.tenantsLinked === 1 ? "" : "s"} and {s.officeLinked} office user{s.officeLinked === 1 ? "" : "s"} get alerts. Tenants turn it on from their Messages page; you turn it on in Operations → Inbox.
            </p>
            <div className="rounded-lg bg-th-raised p-3 text-sm">
              <p className="font-medium text-th-ink">Alerts after 24 hours of silence</p>
              <p className="text-th-muted">
                Facebook only allows normal messages within 24 hours of the person&apos;s last message to your Page. After that, alerts need message templates approved by Meta.
              </p>
              {s.page.tenantTemplateStatus ? (
                <p className="mt-1 text-th-muted">
                  Tenant template: <strong>{STATUS[s.page.tenantTemplateStatus] ?? s.page.tenantTemplateStatus}</strong> · Office template: <strong>{STATUS[s.page.officeTemplateStatus ?? ""] ?? s.page.officeTemplateStatus}</strong>
                </p>
              ) : null}
              {s.page.lastError && <p className="mt-1 text-xs text-th-danger">{s.page.lastError}</p>}
              {s.page.tenantTemplateStatus !== "APPROVED" && (
                <div className="mt-2">
                  <ActionForm url="/api/integrations/facebook" body={{ action: "templates" }} submitLabel={s.page.tenantTemplateStatus ? "Try again" : "Create message templates"} variant="outline" successMessage="Sent to Meta for approval" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/api/integrations/facebook/start" className="rounded-lg border border-th-line px-3 py-2 text-sm text-th-ink hover:bg-th-raised">Switch Page</a>
              <ActionForm url="/api/integrations/facebook" body={{ action: "disconnect" }} submitLabel="Disconnect" variant="destructive" successMessage="Facebook Page disconnected" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <a href="/api/integrations/facebook/start" className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white">
              Connect Facebook Page
            </a>
            <p className="text-xs text-th-faint">You&apos;ll sign in with Facebook and choose your Page. TenantHub only uses it to send and receive tenant messages; you can disconnect any time.</p>
          </div>
        )}
      </section>
    </div>
  );
}
