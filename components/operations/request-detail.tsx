import { ActionForm } from "@/components/collections/action-form";
import { Card, Photos, PriorityPill, StatusPill, when } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { STATUS_LABEL } from "@/lib/operations/maintenance-status";
import type { requestDetail } from "@/lib/operations/maintenance";

type Detail = Awaited<ReturnType<typeof requestDetail>>;

/** Request header + history + the actions the viewer may take. */
export function RequestDetail({ d, apiBase, viewer, people }: { d: Detail; apiBase: string; viewer: "ADMIN" | "CARETAKER" | "TENANT"; people?: { id: string; name: string; role: string }[] }) {
  const r = d.request;
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-th-ink sm:text-2xl">{r.title}</h1>
          <PriorityPill priority={r.priority} />
          <StatusPill status={r.status} />
        </div>
        <p className="mt-1 text-sm text-th-muted">
          {d.unit ? `Room ${d.unit.unitNumber}` : "Common area"}
          {d.property ? ` · ${d.property.name}` : ""}
          {d.tenant ? ` · ${d.tenant.name} (${d.tenant.phone})` : ""} · reported {when(r.createdAt)}
          {r.category ? ` · ${r.category}` : ""}
          {viewer !== "TENANT" && ` · ${d.assignee ? `assigned to ${d.assignee.name}` : "unassigned"}`}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-th-ink">{r.description}</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-th-ink">History</h2>
        {d.updates.length === 0 && <p className="text-sm text-th-muted">No updates yet.</p>}
        <ol className="space-y-2">
          {d.updates.map((u) => (
            <li key={u.id}>
              <Card className="p-3">
                <p className="text-xs text-th-muted">
                  {when(u.at)} · {u.by}
                  {viewer === "ADMIN" && !u.visibleToTenant && <span className="ml-1 rounded bg-th-raised px-1">internal</span>}
                </p>
                {u.statusTo && (
                  <p className="text-sm font-medium text-th-ink">
                    {u.statusFrom ? `${STATUS_LABEL[u.statusFrom]} → ` : ""}
                    {STATUS_LABEL[u.statusTo]}
                  </p>
                )}
                {u.note && <p className="whitespace-pre-wrap text-sm text-th-ink">{u.note}</p>}
                <Photos ids={u.photoFileIds} />
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap items-start gap-2">
        {viewer === "ADMIN" && people && (
          <ActionForm
            url={apiBase}
            body={{ action: "assign" }}
            toggleLabel={d.assignee ? "Reassign" : "Assign"}
            submitLabel="Save"
            successMessage="Assignment saved"
            fields={[{ name: "assignedToId", label: "Assign to", type: "select", defaultValue: d.assignee?.id ?? "", options: [{ value: "", label: "Nobody" }, ...people.map((p) => ({ value: p.id, label: `${p.name}${p.role === "CARETAKER" ? " (caretaker)" : ""}` }))] }]}
          />
        )}
        {(viewer === "ADMIN" || viewer === "CARETAKER") && (
          <ActionForm
            url={apiBase}
            body={{ action: "update" }}
            toggleLabel="Update"
            submitLabel="Save update"
            successMessage="Saved"
            fields={[
              { name: "status", label: "Status", type: "select", defaultValue: "", options: [{ value: "", label: `Keep: ${STATUS_LABEL[r.status]}` }, ...d.moves.map((m) => ({ value: m, label: STATUS_LABEL[m] }))] },
              { name: "note", label: viewer === "CARETAKER" ? "Work note (seen by the office)" : "Note", type: "textarea" },
              ...(viewer === "ADMIN"
                ? [
                    { name: "visibleToTenant", label: "Show this update to the tenant", type: "checkbox" as const, defaultValue: true },
                    { name: "priority", label: "Urgency", type: "select" as const, defaultValue: r.priority, options: ["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })) },
                  ]
                : []),
            ]}
          />
        )}
        {viewer === "TENANT" && r.status !== "CLOSED" && (
          <ActionForm url={apiBase} body={{ action: "note" }} toggleLabel="Add a note" submitLabel="Send" successMessage="Note added" fields={[{ name: "note", label: "Note for the office", type: "textarea", required: true }]} />
        )}
        {r.status !== "CLOSED" && (
          <UploadForm url={apiBase} toggleLabel="Add a photo" fileLabel="Photo" accept="image/jpeg,image/png,image/webp" fields={[{ name: "caption", label: "Caption" }]} submitLabel="Upload" successMessage="Photo added" />
        )}
      </section>
    </div>
  );
}
