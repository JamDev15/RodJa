import Link from "next/link";
import { Stat } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Card, Empty, OpsNav, PriorityPill, StatusPill } from "@/components/operations/bits";
import { formatDateOnly } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { operationsSummary } from "@/lib/operations/summary";

export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const s = await operationsSummary(actor, propertyId);
  const name = properties.find((p) => p.id === propertyId)?.name ?? "";
  const q = `propertyId=${propertyId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Operations</h1>
          <p className="text-sm text-th-muted">{name} · tenancies, maintenance and messages</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="overview" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Occupancy" value={`${s.occupancy.occupied} / ${s.occupancy.rooms}`} hint={`${s.occupancy.rate}% of rooms have an active tenant`} />
        <Stat label="Open maintenance" value={s.maintenance.open} tone={s.maintenance.urgent ? "danger" : undefined} hint={`${s.maintenance.urgent} high/urgent · ${s.maintenance.unassigned} unassigned`} />
        <Stat label="Leases ending (60 days)" value={s.leases.length} tone={s.leases.length ? "due" : undefined} hint="Recorded lease terms not yet renewed" />
        <Stat label="Unread messages" value={s.messages.unread} tone={s.messages.unread ? "due" : undefined} hint={`${s.messages.open} open conversations`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-th-ink">Vacant rooms</h2>
          {s.occupancy.vacantRooms.length ? <p className="text-sm text-th-muted">{s.occupancy.vacantRooms.join(", ")}</p> : <p className="text-sm text-th-muted">Every room is occupied.</p>}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-th-ink">Maintenance</h2>
            <Link href={`/dashboard/operations/maintenance?${q}`} className="text-sm text-th-accent hover:underline">All requests</Link>
          </div>
          {s.maintenance.top.length === 0 ? (
            <p className="text-sm text-th-muted">Nothing open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {s.maintenance.top.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/dashboard/operations/maintenance/${r.id}`} className="min-w-0 truncate text-th-accent hover:underline">{r.room ? `Room ${r.room} · ` : "Common area · "}{r.title}</Link>
                  <span className="flex gap-1"><PriorityPill priority={r.priority} /><StatusPill status={r.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-th-ink">Leases ending soon</h2>
          {s.leases.length === 0 ? (
            <p className="text-sm text-th-muted">None in the next 60 days. Lease dates show here once recorded on each tenancy.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {s.leases.map((l) => (
                <li key={l.id}><Link href={`/dashboard/operations/tenancies/${l.tenantId}`} className="text-th-accent hover:underline">Room {l.room} · {l.tenantName}</Link> <span className="text-th-muted">ends {formatDateOnly(l.endDate)}</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-th-ink">Move-ins and move-outs</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-th-muted">Moving out</p>
              {s.moveOuts.length === 0 ? <p className="text-th-muted">None in progress.</p> : s.moveOuts.map((m) => (
                <p key={m.id}><Link href={`/dashboard/operations/moveouts/${m.id}`} className="text-th-accent hover:underline">Room {m.room} · {m.tenantName}</Link> <span className="text-th-muted">planned {formatDateOnly(m.plannedDate)}</span></p>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-th-muted">Moving in (next 30 days)</p>
              {s.moveIns.length === 0 ? <p className="text-th-muted">None scheduled.</p> : s.moveIns.map((m) => (
                <p key={m.tenantId}><Link href={`/dashboard/operations/tenancies/${m.tenantId}`} className="text-th-accent hover:underline">Room {m.room} · {m.tenantName}</Link> <span className="text-th-muted">{formatDateOnly(m.date)}</span></p>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-th-muted">Recent move-ins with an unfinished checklist</p>
              {s.moveInChecklistsOpen.length === 0 ? <p className="text-th-muted">All done.</p> : s.moveInChecklistsOpen.map((m) => (
                <p key={m.tenantId}><Link href={`/dashboard/operations/tenancies/${m.tenantId}`} className="text-th-accent hover:underline">Room {m.room} · {m.tenantName}</Link> <span className="text-th-muted">{m.started ? "in progress" : "not started"}</span></p>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
