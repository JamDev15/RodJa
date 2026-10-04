import Link from "next/link";
import { Plus, Workflow as WorkflowIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { WORKFLOW_TEMPLATES, WORKFLOW_TRIGGERS, leadStatusLabel, totalDays, type WorkflowStep } from "@/lib/workflow-meta";
import { WorkflowToggle } from "@/components/workflows/workflow-toggle";

export default async function AdminWorkflowsPage() {
  const workflows = await prisma.workflow.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await prisma.workflowEnrollment.groupBy({ by: ["workflowId", "status"], _count: { _all: true } });
  const countFor = (id: string, status: string) => counts.find((c) => c.workflowId === id && c.status === status)?._count._all ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Workflows</h1>
          <p className="text-th-muted text-sm mt-1">Automatic follow-up sequences for signups — email, SMS, status changes, and reminders to you.</p>
        </div>
        <Link href="/admin/workflows/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
          <Plus className="h-4 w-4" /> New workflow
        </Link>
      </div>

      {workflows.length > 0 && (
        <ul className="space-y-3">
          {workflows.map((w) => {
            const steps = (w.steps as unknown as WorkflowStep[]) ?? [];
            const trig = WORKFLOW_TRIGGERS.find((t) => t.value === w.trigger)?.label ?? w.trigger;
            return (
              <li key={w.id} className={`rounded-xl border p-4 ${w.isActive ? "border-th-line bg-th-surface" : "border-th-line bg-th-surface opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-th-violet-soft text-th-violet"><WorkflowIcon className="h-4 w-4" /></span>
                  <Link href={`/admin/workflows/${w.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-th-ink hover:text-th-violet">{w.name}</p>
                    <p className="text-xs text-th-muted">
                      {trig}{w.trigger === "lead_status" && w.triggerValue ? ` “${leadStatusLabel(w.triggerValue)}”` : ""} · {steps.length} steps · {totalDays(steps)} days
                    </p>
                    <p className="mt-2 text-xs text-th-faint">
                      <span className="text-th-paid">{countFor(w.id, "active")} active</span> · {countFor(w.id, "completed")} completed · {countFor(w.id, "exited")} exited
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <WorkflowToggle id={w.id} isActive={w.isActive} />
                    <Link href={`/admin/workflows/${w.id}`} className="text-xs text-th-violet hover:text-th-violet">Edit →</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-th-ink/80">{workflows.length ? "Add from a template" : "Start from a template"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((t) => (
            <Link key={t.key} href={`/admin/workflows/new?template=${t.key}`} className="rounded-xl border border-th-line bg-th-surface p-4 transition-colors hover:border-th-violet/40 hover:bg-th-violet-soft">
              <p className="text-sm font-semibold text-th-ink">{t.name}</p>
              <p className="mt-1 text-xs text-th-muted">{t.description}</p>
              <p className="mt-2 text-[11px] text-th-faint">{t.steps.length} steps · {totalDays(t.steps)} days</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
