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
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-gray-400 text-sm mt-1">Automatic follow-up sequences for signups — email, SMS, status changes, and reminders to you.</p>
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
              <li key={w.id} className={`rounded-xl border p-4 ${w.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300"><WorkflowIcon className="h-4 w-4" /></span>
                  <Link href={`/admin/workflows/${w.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-white hover:text-purple-300">{w.name}</p>
                    <p className="text-xs text-gray-400">
                      {trig}{w.trigger === "lead_status" && w.triggerValue ? ` “${leadStatusLabel(w.triggerValue)}”` : ""} · {steps.length} steps · {totalDays(steps)} days
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="text-green-400">{countFor(w.id, "active")} active</span> · {countFor(w.id, "completed")} completed · {countFor(w.id, "exited")} exited
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <WorkflowToggle id={w.id} isActive={w.isActive} />
                    <Link href={`/admin/workflows/${w.id}`} className="text-xs text-purple-300 hover:text-purple-200">Edit →</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">{workflows.length ? "Add from a template" : "Start from a template"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKFLOW_TEMPLATES.map((t) => (
            <Link key={t.key} href={`/admin/workflows/new?template=${t.key}`} className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-purple-500/40 hover:bg-purple-500/10">
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="mt-1 text-xs text-gray-400">{t.description}</p>
              <p className="mt-2 text-[11px] text-gray-500">{t.steps.length} steps · {totalDays(t.steps)} days</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
