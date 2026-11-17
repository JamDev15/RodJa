import Link from "next/link";
import { formatCentavos } from "@/lib/collections/money";
import { formatDateOnly, formatMonth, parsePeriodKey } from "@/lib/collections/calendar";
import { cn } from "@/lib/utils";

export function Money({ c, className }: { c: number | null | undefined; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatCentavos(c ?? 0)}</span>;
}

const PILL: Record<string, string> = {
  PAID: "bg-th-paid-soft text-th-paid",
  VERIFIED: "bg-th-paid-soft text-th-paid",
  APPROVED: "bg-th-paid-soft text-th-paid",
  PUBLISHED: "bg-th-brand-soft text-th-accent",
  PARTIALLY_PAID: "bg-th-brand-soft text-th-accent",
  PENDING: "bg-th-due-soft text-th-due",
  DRAFT: "bg-th-raised text-th-muted",
  UNPAID: "bg-th-due-soft text-th-due",
  OVERDUE: "bg-th-danger-soft text-th-danger",
  PARTIALLY_PAID_OVERDUE: "bg-th-danger-soft text-th-danger",
  REJECTED: "bg-th-danger-soft text-th-danger",
  REVERSED: "bg-th-raised text-th-muted",
};

const LABEL: Record<string, string> = {
  PARTIALLY_PAID: "Partly paid",
  PARTIALLY_PAID_OVERDUE: "Partly paid · overdue",
  PUBLISHED: "Issued",
  PENDING: "Pending review",
};

export function Pill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", PILL[status] ?? "bg-th-raised text-th-muted", className)}>
      {LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

export function periodLabel(periodKey: string, cycleDate?: string) {
  const p = parsePeriodKey(periodKey);
  if (!p) return periodKey;
  return cycleDate ? `${formatDateOnly(cycleDate)} cycle` : `${formatMonth(p.month)} · cycle ${p.key}`;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "due" | "paid" }) {
  return (
    <div className="rounded-xl border border-th-line bg-th-surface p-4">
      <p className="text-xs font-medium text-th-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-bold text-th-ink", tone === "danger" && "text-th-danger", tone === "due" && "text-th-due", tone === "paid" && "text-th-paid")}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-th-faint">{hint}</p>}
    </div>
  );
}

export function SubNav({ propertyId, active }: { propertyId: string; active: string }) {
  const items = [
    ["overview", "Overview", `/dashboard/collections?propertyId=${propertyId}`],
    ["statements", "Statements", `/dashboard/collections/statements?propertyId=${propertyId}`],
    ["water", "Water meters", `/dashboard/collections/water?propertyId=${propertyId}`],
    ["veco", "VECO receipts", `/dashboard/collections/veco?propertyId=${propertyId}`],
    ["settings", "Setup", `/dashboard/collections/settings?propertyId=${propertyId}`],
  ];
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Collections">
      {items.map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
            active === key ? "bg-th-brand text-th-on-brand" : "text-th-muted hover:bg-th-raised hover:text-th-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function Section({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-th-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FileLink({ id, label = "View proof" }: { id: string | null | undefined; label?: string }) {
  if (!id) return <span className="text-xs text-th-faint">No file</span>;
  return (
    <a href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-th-accent underline-offset-2 hover:underline">
      {label}
    </a>
  );
}
