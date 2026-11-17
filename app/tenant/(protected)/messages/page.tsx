import Link from "next/link";
import { redirect } from "next/navigation";
import { when } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { MessengerCard } from "@/components/operations/messenger-card";
import { linkStatus } from "@/lib/messenger";
import { currentActor } from "@/lib/collections/actor";
import { ownTenancy } from "@/lib/operations/common";
import { listThreads, tenantFeaturesEnabled } from "@/lib/operations/messages";

export default async function TenantMessagesPage() {
  const actor = await currentActor();
  if (!actor || actor.kind !== "TENANT") redirect("/tenant/login");
  const tenant = await ownTenancy(actor);
  if (!(await tenantFeaturesEnabled(tenant.unit.propertyId))) redirect("/tenant/dashboard");
  const [threads, messenger] = await Promise.all([listThreads(actor), linkStatus({ kind: "TENANT", tenantId: tenant.id }, tenant.unit.property.accountId)]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-th-ink">Messages</h1>
        <p className="text-sm text-th-muted">Private messages with the office of {tenant.unit.property.name}</p>
      </div>
      <MessengerCard available={messenger.available} linked={messenger.linked} connectHref="/api/tenant/messenger" apiUrl="/api/tenant/messenger" audience="tenant" />
      <UploadForm
        url="/api/tenant/messages"
        toggleLabel="Message the office"
        fields={[
          { name: "subject", label: "Subject", required: true, placeholder: "e.g. Question about my statement" },
          { name: "body", label: "Message", type: "textarea", required: true },
        ]}
        fileLabel="Attach a photo or PDF"
        fileRequired={false}
        submitLabel="Send"
        successMessage="Message sent"
      />
      <p className="text-xs text-th-faint">For repairs, use Repairs so the work can be tracked. For payments, upload proof under Bills.</p>
      {threads.length === 0 ? (
        <p className="text-sm text-th-muted">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/tenant/messages/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-th-line bg-th-surface p-4">
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${t.unread ? "font-semibold text-th-ink" : "text-th-ink"}`}>{t.subject}</span>
                  <span className="text-xs text-th-faint">{when(t.lastMessageAt.toISOString())}</span>
                </span>
                {t.unread && <span className="shrink-0 rounded-full bg-th-due-soft px-2 py-0.5 text-xs font-semibold text-th-due">New reply</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
