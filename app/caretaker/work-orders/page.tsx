import Link from "next/link";
import { redirect } from "next/navigation";
import { PriorityPill, StatusPill } from "@/components/operations/bits";
import { currentActor } from "@/lib/collections/actor";
import { formatDateOnly } from "@/lib/collections/calendar";
import { listRequests } from "@/lib/operations/maintenance";

/** Requests the office assigned to this caretaker (no tenant names or contact details). */
export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const actor = await currentActor();
  if (!actor || actor.kind !== "CARETAKER") redirect(actor ? "/dashboard/operations/maintenance" : "/login");
  const all = sp.show === "all";
  const rows = await listRequests(actor, { status: all ? "all" : "open" });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-th-ink">Work orders</h1>
        <Link href={all ? "/caretaker/work-orders" : "/caretaker/work-orders?show=all"} className="text-sm text-th-accent hover:underline">{all ? "Open only" : "Show all"}</Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-th-line bg-th-surface p-6 text-sm text-th-muted">Nothing assigned to you{all ? "" : " right now"}.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/caretaker/work-orders/${r.id}`} className="block rounded-xl border border-th-line bg-th-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium text-th-ink">{r.title}</span>
                  <span className="flex shrink-0 gap-1"><PriorityPill priority={r.priority} /><StatusPill status={r.status} /></span>
                </div>
                <p className="mt-1 text-xs text-th-muted">{r.room ? `Room ${r.room}` : "Common area"} · {formatDateOnly(r.createdAt.slice(0, 10))}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
