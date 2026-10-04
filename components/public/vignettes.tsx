import { Bell, Check, Clock, FileText, Mail, MessageSquare, XCircle } from "lucide-react";

/** Small, static slices of the real product used beside each feature on the homepage. */

const frame = "th-shadow rounded-2xl border border-th-line bg-th-surface";

export function ContractVignette() {
  return (
    <div className={`${frame} p-5 sm:p-6`}>
      <p className="text-[15px] font-semibold text-th-ink">Residential Lease Agreement</p>
      <p className="text-[13px] text-th-muted">Unit 2B, Santos Apartments · 12 months · ₱8,000/month</p>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full rounded-full bg-th-raised" />
        <div className="h-2 w-11/12 rounded-full bg-th-raised" />
        <div className="h-2 w-4/5 rounded-full bg-th-raised" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-5">
        {[
          { who: "Juan Santos", role: "Owner", when: "Signed Oct 1" },
          { who: "Maria dela Cruz", role: "Tenant", when: "Signed Oct 1, on her phone" },
        ].map((s, i) => (
          <div key={s.role}>
            <svg viewBox="0 0 160 44" className="h-11 w-full text-th-ink" aria-hidden>
              <path
                d={i === 0 ? "M6 30c14-22 22 10 34-4s14-16 22 0 20-14 30 2 18-10 30-4 16 8 30-2" : "M8 28c10-16 26-18 30 0s16-24 26-6 14 14 28 0 22-12 32 4 14 0 28-6"}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <div className="border-t border-th-ink/70 pt-1.5">
              <p className="text-[13px] font-semibold text-th-ink">{s.who}</p>
              <p className="text-[12px] text-th-muted">{s.role} · {s.when}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-lg bg-th-paid-soft px-3 py-2 text-[13px] font-medium text-th-paid">
        <Check className="h-4 w-4" strokeWidth={2.5} /> Signed PDF sent to both of you
      </div>
    </div>
  );
}

export function HistoryVignette() {
  const rows = [
    { icon: Mail, title: "Receipt RCPT-00128", to: "Maria dela Cruz", time: "9:41 AM", ok: true },
    { icon: MessageSquare, title: "Rent due in 3 days", to: "Paolo Reyes", time: "8:00 AM", ok: true },
    { icon: FileText, title: "Invoice INV-00311", to: "Joy Santiago", time: "Yesterday", ok: true },
    { icon: MessageSquare, title: "Overdue: ₱8,200", to: "Ben Aquino", time: "Yesterday", ok: false },
  ];
  return (
    <div className={`${frame} overflow-hidden`}>
      <div className="border-b border-th-line px-5 py-3.5">
        <p className="text-[15px] font-semibold text-th-ink">Message history</p>
      </div>
      <ul className="divide-y divide-th-line">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-th-raised text-th-muted"><r.icon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-th-ink">{r.title}</p>
              <p className="text-[12px] text-th-muted">to {r.to}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-th-faint">{r.time}</p>
              {r.ok ? (
                <p className="inline-flex items-center gap-1 text-[12px] font-medium text-th-paid"><Check className="h-3 w-3" strokeWidth={3} />Sent</p>
              ) : (
                <p className="inline-flex items-center gap-1 text-[12px] font-medium text-th-danger"><XCircle className="h-3 w-3" />No number</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkflowVignette() {
  const steps = [
    { icon: FileText, label: "Send October invoice", meta: "Oct 1", done: true },
    { icon: Clock, label: "Wait 2 days", meta: "", done: true },
    { icon: MessageSquare, label: "SMS: “Your rent is due on the 5th”", meta: "Oct 3", done: true },
    { icon: Clock, label: "Wait 5 days", meta: "", done: false },
    { icon: Bell, label: "If still unpaid, alert me", meta: "Skipped — paid Oct 4", done: false, skipped: true },
  ];
  return (
    <div className={`${frame} p-5 sm:p-6`}>
      <p className="text-[15px] font-semibold text-th-ink">Monthly collection</p>
      <p className="text-[13px] text-th-muted">Runs for every tenant on the 1st. Stops once they pay.</p>
      <ol className="relative mt-5 space-y-3.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-th-line">
        {steps.map((s) => (
          <li key={s.label} className="relative flex items-center gap-3">
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                s.done ? "border-th-brand bg-th-brand text-th-on-brand" : "border-th-line bg-th-surface text-th-faint"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
            </span>
            <p className={`flex-1 text-[14px] ${s.skipped ? "text-th-faint line-through" : s.done ? "text-th-ink" : "text-th-muted"}`}>{s.label}</p>
            {s.meta && <span className={`text-[12px] ${s.skipped ? "text-th-paid" : "text-th-faint"}`}>{s.meta}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
