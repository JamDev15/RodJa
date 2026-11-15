import { ActionForm } from "@/components/collections/action-form";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Card, Empty, OpsNav, when } from "@/components/operations/bits";
import { adminPageContext } from "@/lib/collections/page-context";
import { listAnnouncements } from "@/lib/operations/announcements";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const rows = await listAnnouncements(actor, propertyId);
  const name = properties.find((p) => p.id === propertyId)?.name ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Announcements</h1>
          <p className="text-sm text-th-muted">Posted to every current tenant of {name} on their Notices page</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="announcements" />

      <ActionForm
        url="/api/operations/announcements"
        body={{ propertyId }}
        submitLabel="Post announcement"
        size="default"
        successMessage="Announcement posted"
        fields={[
          { name: "title", label: "Title", type: "text", required: true, placeholder: "e.g. Water interruption on Saturday" },
          { name: "content", label: "Message", type: "textarea", required: true },
          { name: "type", label: "Type", type: "select", defaultValue: "general", options: [{ value: "general", label: "General" }, { value: "urgent", label: "Urgent" }, { value: "maintenance", label: "Maintenance" }, { value: "payment", label: "Payment" }] },
          { name: "email", label: "Also email tenants who have an email address", type: "checkbox", hint: "Free through the existing email service. Tenants without email see it in the portal." },
        ]}
      />

      {rows.length === 0 ? (
        <Empty>No announcements yet.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <Card key={n.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-th-ink">{n.title}</p>
                  <p className="text-xs text-th-muted">{when(n.createdAt.toISOString())} · {n.type}</p>
                </div>
                <ActionForm url={`/api/operations/announcements/${n.id}`} method="DELETE" submitLabel="Remove" variant="outline" successMessage="Removed" />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-th-ink">{n.content}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
