import Link from "next/link";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { prisma } from "@/lib/prisma";
import { currentTerm } from "@/lib/operations/leases";
import { today, toDateOnly } from "@/lib/operations/common";

export default async function TenanciesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; show?: string }> }) {
  const sp = await searchParams;
  const { properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const showEnded = sp.show === "ended";
  const tenants = await prisma.tenant.findMany({
    where: { unit: { propertyId }, isActive: !showEnded },
    select: {
      id: true,
      name: true,
      moveInDate: true,
      moveOutDate: true,
      occupantCount: true,
      unit: { select: { unitNumber: true } },
      occupants: { where: { movedOutOn: null }, select: { id: true } },
      leaseTerms: { select: { startDate: true, endDate: true } },
      moveOut: { select: { id: true, status: true, plannedDate: true } },
      checklists: { select: { kind: true, status: true } },
    },
    orderBy: [{ unit: { unitNumber: "asc" } }, { moveInDate: "desc" }],
    take: 300,
  });
  const day = today();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Tenancies</h1>
          <p className="text-sm text-th-muted">Household, move-in, lease, deposit and move-out for each tenancy</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="tenancies" />
      <div className="flex gap-2 text-sm">
        <Link href={`?propertyId=${propertyId}`} className={!showEnded ? "font-semibold text-th-ink" : "text-th-accent hover:underline"}>Current</Link>
        <span className="text-th-faint">·</span>
        <Link href={`?propertyId=${propertyId}&show=ended`} className={showEnded ? "font-semibold text-th-ink" : "text-th-accent hover:underline"}>Moved out</Link>
      </div>
      {tenants.length === 0 ? (
        <Empty>No {showEnded ? "past" : "current"} tenancies. Tenants are added from the Tenants page.</Empty>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {tenants.map((t) => {
            const term = currentTerm(t.leaseTerms, day);
            const moveIn = t.checklists.find((c) => c.kind === "MOVE_IN");
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/dashboard/operations/tenancies/${t.id}`} className="font-medium text-th-accent hover:underline">Room {t.unit.unitNumber} · {t.name}</Link>
                  <p className="text-xs text-th-muted">
                    Moved in {formatDateOnly(toDateOnly(t.moveInDate))}
                    {t.moveOutDate ? ` · moved out ${formatDateOnly(toDateOnly(t.moveOutDate))}` : ""}
                    {term?.endDate ? ` · lease to ${formatDateOnly(fromDbDate(term.endDate))}` : " · no lease dates"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-th-raised px-2 py-0.5 text-th-muted">{t.occupants.length || t.occupantCount || 0} in room</span>
                  {!showEnded && <span className={`rounded-full px-2 py-0.5 ${moveIn?.status === "COMPLETED" ? "bg-th-paid-soft text-th-paid" : "bg-th-due-soft text-th-due"}`}>Move-in {moveIn?.status === "COMPLETED" ? "done" : moveIn ? "in progress" : "not started"}</span>}
                  {t.moveOut?.status === "IN_PROGRESS" && <span className="rounded-full bg-th-danger-soft px-2 py-0.5 text-th-danger">Moving out {formatDateOnly(fromDbDate(t.moveOut.plannedDate))}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
