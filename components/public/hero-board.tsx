import { Check } from "lucide-react";
import { BrandMark } from "./brand";

type Row = { name: string; place: string; amount: string; status: "paid" | "due" | "late"; label: string };

const ROWS: Row[] = [
  { name: "Ramon Villanueva", place: "Santos Apartments · Unit 1A", amount: "₱7,500", status: "paid", label: "Paid" },
  { name: "Maria dela Cruz", place: "Santos Apartments · Unit 2B", amount: "₱9,550", status: "due", label: "Due Oct 5" },
  { name: "Joy Santiago", place: "Lim Boarding House · Room 3", amount: "₱3,800", status: "late", label: "2 days late" },
];

function initials(name: string) {
  const parts = name.split(" ");
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Pill({ status, children }: { status: Row["status"]; children: React.ReactNode }) {
  const cls =
    status === "paid" ? "bg-th-paid-soft text-th-paid" : status === "late" ? "bg-th-due-soft text-th-due" : "bg-th-raised text-th-muted";
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/**
 * Hero product preview: the owner's month at a glance. On load, Maria's row
 * settles to Paid and a "receipt sent" toast appears (CSS only; shown settled
 * when reduced motion is on).
 */
export function HeroBoard() {
  return (
    <div className="relative">
      <div className="rounded-[22px] border border-th-line bg-th-tint p-3 sm:p-4">
        <div className="flex items-center justify-between px-2 pb-3 pt-1">
          <p className="th-eyebrow">Your rentals, at a glance</p>
          <p className="hidden text-[11px] text-th-faint sm:block">Sample data</p>
        </div>

        <div className="th-shadow overflow-hidden rounded-2xl border border-th-line bg-th-surface">
          <div className="flex items-center justify-between border-b border-th-line px-4 py-3">
            <div className="flex items-center gap-2">
              <BrandMark className="h-5 w-5" />
              <span className="text-[13px] font-semibold text-th-ink">TenantHub</span>
            </div>
            <span className="rounded-full bg-th-raised px-2.5 py-1 text-[11px] text-th-muted">Santos Apartments</span>
          </div>
          <div className="flex gap-5 border-b border-th-line px-4 text-[12px]">
            <span className="border-b-2 border-th-ink py-2.5 font-semibold text-th-ink">Rent overview</span>
            <span className="py-2.5 text-th-muted">Messages</span>
            <span className="py-2.5 text-th-muted">Contracts</span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-th-ink">October rent</p>
              <span className="rounded-md border border-th-line px-2 py-1 text-[11px] text-th-muted">Oct 2026</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] text-th-muted">Collected</p>
                <p className="tabular font-serif text-[32px] leading-none tracking-[-0.02em] text-th-ink sm:text-[40px]">
                  ₱7,500<span className="text-[18px] text-th-faint">.00</span>
                </p>
                <p className="mt-1.5 text-[11px] text-th-muted">1 of 3 tenants paid</p>
              </div>
              <div>
                <p className="text-[12px] text-th-muted">Still expected</p>
                <p className="tabular font-serif text-[32px] leading-none tracking-[-0.02em] text-th-ink sm:text-[40px]">
                  ₱13,350<span className="text-[18px] text-th-faint">.00</span>
                </p>
                <p className="mt-1.5 text-[11px] text-th-muted">Reminders already scheduled</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-th-raised">
              <div className="h-full w-[36%] rounded-full bg-th-paid" />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-th-ink">Your tenants</p>
              <p className="text-[11px] text-th-muted">3 tenants · 2 properties</p>
            </div>
            <ul className="mt-2 divide-y divide-th-line rounded-xl border border-th-line">
              {ROWS.map((r) => {
                const animated = r.name.startsWith("Maria");
                return (
                  <li key={r.name} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-th-raised text-[11px] font-semibold text-th-muted">{initials(r.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-th-ink">{r.name}</p>
                      <p className="truncate text-[11px] text-th-muted">{r.place}</p>
                    </div>
                    <p className="tabular text-[13px] font-semibold text-th-ink">{r.amount}</p>
                    <div className="w-[84px] text-right">
                      {animated ? (
                        <span className="inline-grid">
                          <span className="th-anim-due col-start-1 row-start-1"><Pill status="due">{r.label}</Pill></span>
                          <span className="th-anim-paid col-start-1 row-start-1"><Pill status="paid"><Check className="h-3 w-3" strokeWidth={3} />Paid</Pill></span>
                        </span>
                      ) : (
                        <Pill status={r.status}>{r.status === "paid" && <Check className="h-3 w-3" strokeWidth={3} />}{r.label}</Pill>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-th-paid/25 bg-th-paid-soft px-3.5 py-2.5">
              <div>
                <p className="text-[12px] font-semibold text-th-paid">Paid through GCash</p>
                <p className="text-[11px] text-th-muted">Maria uploaded her proof. One tap to approve.</p>
              </div>
              <span className="shrink-0 rounded-lg bg-th-brand px-3 py-1.5 text-[11px] font-semibold text-th-on-brand">Approve</span>
            </div>
          </div>
        </div>

        <p className="px-2 pt-3 text-[11px] text-th-faint">Illustrative product preview with sample data</p>
      </div>

      <div className="th-anim-chip th-shadow absolute -bottom-6 right-3 flex items-center gap-3 rounded-xl border border-th-line bg-th-surface px-3.5 py-2.5 sm:-right-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-th-paid-soft text-th-paid"><Check className="h-4 w-4" strokeWidth={2.5} /></span>
        <div>
          <p className="text-[12px] font-semibold text-th-ink">Receipt sent.</p>
          <p className="text-[11px] text-th-muted">Maria dela Cruz · ₱9,550 recorded</p>
        </div>
      </div>
    </div>
  );
}
