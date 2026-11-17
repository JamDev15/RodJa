import Link from "next/link";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav, when } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { adminPageContext } from "@/lib/collections/page-context";
import { prisma } from "@/lib/prisma";
import { listThreads } from "@/lib/operations/messages";
import { MessengerCard } from "@/components/operations/messenger-card";
import { linkStatus } from "@/lib/messenger";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; tenantId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const [threads, tenants, messenger] = await Promise.all([
    listThreads(actor, { propertyId }),
    prisma.tenant.findMany({ where: { isActive: true, unit: { propertyId } }, select: { id: true, name: true, unit: { select: { unitNumber: true } } }, orderBy: { unit: { unitNumber: "asc" } } }),
    linkStatus({ kind: "ADMIN", accountId: actor.accountId, userId: actor.id }),
  ]);
  const shown = sp.tenantId ? threads.filter((t) => t.tenantId === sp.tenantId) : threads;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Inbox</h1>
          <p className="text-sm text-th-muted">Private conversations with tenants. Caretakers can&apos;t see these.</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="inbox" />
      <MessengerCard available={messenger.available} linked={messenger.linked} connectHref="/api/operations/messenger" apiUrl="/api/operations/messenger" audience="office" />

      {tenants.length > 0 && (
        <UploadForm
          url="/api/operations/messages"
          toggleLabel="New message to a tenant"
          fields={[
            { name: "tenantId", label: "To", type: "select", defaultValue: sp.tenantId, options: tenants.map((t) => ({ value: t.id, label: `Room ${t.unit.unitNumber} · ${t.name}` })) },
            { name: "subject", label: "Subject", required: true },
            { name: "body", label: "Message", type: "textarea", required: true },
          ]}
          fileLabel="Attach a photo or PDF"
          fileRequired={false}
          submitLabel="Send"
          successMessage="Message sent"
        />
      )}

      {sp.tenantId && (
        <Link href={`?propertyId=${propertyId}`} className="text-sm text-th-accent hover:underline">Show all conversations</Link>
      )}
      {shown.length === 0 ? (
        <Empty>No conversations yet.</Empty>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {shown.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/operations/inbox/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-th-raised">
                <span className="min-w-0">
                  <span className={t.unread ? "font-semibold text-th-ink" : "text-th-ink"}>{t.subject}</span>
                  <span className="block text-xs text-th-muted">Room {t.room} · {t.tenantName} · {when(t.lastMessageAt.toISOString())}</span>
                </span>
                <span className="flex gap-1.5 text-xs">
                  {t.unread && <span className="rounded-full bg-th-due-soft px-2 py-0.5 font-semibold text-th-due">New</span>}
                  {t.status === "CLOSED" && <span className="rounded-full bg-th-raised px-2 py-0.5 text-th-muted">Closed</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
