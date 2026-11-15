import Link from "next/link";
import { ActionForm } from "@/components/collections/action-form";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav, PriorityPill, StatusPill } from "@/components/operations/bits";
import { formatDateOnly } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { prisma } from "@/lib/prisma";
import { assignees, listRequests, STATUSES, STATUS_LABEL, type MaintenanceStatus } from "@/lib/operations/maintenance";

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ propertyId?: string; status?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const status = sp.status === "all" ? "all" : (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as MaintenanceStatus) : "open";
  const [rows, units, people] = await Promise.all([
    listRequests(actor, { propertyId, status }),
    prisma.unit.findMany({ where: { propertyId }, select: { id: true, unitNumber: true }, orderBy: { unitNumber: "asc" } }),
    assignees(actor, propertyId),
  ]);
  const filters: [string, string][] = [["open", "Open"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string]), ["all", "All"]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Maintenance</h1>
          <p className="text-sm text-th-muted">Tenant requests and work orders</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="maintenance" />

      <ActionForm
        url="/api/operations/maintenance"
        body={{ propertyId }}
        toggleLabel="Log a request / work order"
        submitLabel="Create"
        successMessage="Request created"
        fields={[
          { name: "unitId", label: "Room", type: "select", options: [{ value: "", label: "Common area / no room" }, ...units.map((u) => ({ value: u.id, label: `Room ${u.unitNumber}` }))] },
          { name: "title", label: "Title", type: "text", required: true },
          { name: "description", label: "Details", type: "textarea", required: true },
          { name: "priority", label: "Urgency", type: "select", defaultValue: "normal", options: [{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }] },
          { name: "category", label: "Category", type: "text", placeholder: "e.g. plumbing, electrical" },
          { name: "assignedToId", label: "Assign to", type: "select", options: [{ value: "", label: "Not yet" }, ...people.map((p) => ({ value: p.id, label: `${p.name}${p.role === "CARETAKER" ? " (caretaker)" : ""}` }))] },
        ]}
      />

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label="Status filter">
        {filters.map(([key, label]) => (
          <Link key={key} href={`?propertyId=${propertyId}&status=${key}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${status === key ? "bg-th-raised font-semibold text-th-ink" : "text-th-muted hover:text-th-ink"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Empty>No requests here.</Empty>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <Link href={`/dashboard/operations/maintenance/${r.id}`} className="font-medium text-th-accent hover:underline">{r.title}</Link>
                <p className="text-xs text-th-muted">
                  {r.room ? `Room ${r.room}` : "Common area"}
                  {r.tenantName ? ` · ${r.tenantName}` : ""} · {formatDateOnly(r.createdAt.slice(0, 10))}
                  {r.assignee ? ` · ${r.assignee}` : " · unassigned"}
                </p>
              </div>
              <span className="flex gap-1">
                <PriorityPill priority={r.priority} />
                <StatusPill status={r.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
