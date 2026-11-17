import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type MaintenanceStatus } from "@/lib/operations/maintenance-status";

export function OpsNav({ propertyId, active }: { propertyId: string; active: string }) {
  const q = `?propertyId=${propertyId}`;
  const items: [string, string, string][] = [
    ["overview", "Overview", `/dashboard/operations${q}`],
    ["tenancies", "Tenancies", `/dashboard/operations/tenancies${q}`],
    ["maintenance", "Maintenance", `/dashboard/operations/maintenance${q}`],
    ["inbox", "Inbox", `/dashboard/operations/inbox${q}`],
    ["announcements", "Announcements", `/dashboard/operations/announcements${q}`],
    ["checklists", "Checklists", `/dashboard/operations/checklists${q}`],
    ["expenses", "Expenses", `/dashboard/operations/expenses${q}`],
    ["petty-cash", "Petty cash", `/dashboard/operations/petty-cash${q}`],
    ["utilities", "Utilities", `/dashboard/operations/utilities${q}`],
    ["reports", "Reports", `/dashboard/operations/reports${q}`],
  ];
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Operations">
      {items.map(([key, label, href]) => (
        <Link key={key} href={href} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", active === key ? "bg-th-brand text-th-on-brand" : "text-th-muted hover:bg-th-raised hover:text-th-ink")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

const STATUS_TONE: Record<MaintenanceStatus, string> = {
  SUBMITTED: "bg-th-due-soft text-th-due",
  ASSIGNED: "bg-th-brand-soft text-th-accent",
  IN_PROGRESS: "bg-th-brand-soft text-th-accent",
  WAITING: "bg-th-raised text-th-muted",
  COMPLETED: "bg-th-paid-soft text-th-paid",
  CLOSED: "bg-th-raised text-th-muted",
};

export function StatusPill({ status }: { status: MaintenanceStatus }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function PriorityPill({ priority }: { priority: string }) {
  const tone = priority === "urgent" ? "bg-th-danger-soft text-th-danger" : priority === "high" ? "bg-th-due-soft text-th-due" : "bg-th-raised text-th-muted";
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize", tone)}>{priority}</span>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-th-line bg-th-surface p-4", className)}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-th-line p-4 text-sm text-th-muted">{children}</p>;
}

export function Photos({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ids.map((id) => (
        <a key={id} href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg border border-th-line bg-th-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
          <img src={`/api/files/${id}`} alt="Attached photo" className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export function when(iso: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
}
