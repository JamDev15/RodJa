import Link from "next/link";
import { Plus, Workflow as WorkflowIcon, Pencil } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OWNER_WORKFLOW_TEMPLATES, triggerSummary, type OwnerWorkflowStep } from "@/lib/owner-workflow-meta";
import { WorkflowToggle } from "@/components/workflows/workflow-toggle";
import { RunWorkflowsButton } from "./run-button";

export default async function OwnerWorkflowsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const workflows = await prisma.ownerWorkflow.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  const counts = await prisma.ownerWorkflowEnrollment.groupBy({
    by: ["workflowId", "status"],
    where: { workflow: { accountId } },
    _count: { _all: true },
  });
  const countFor = (id: string, status: string) => counts.find((c) => c.workflowId === id && c.status === status)?._count._all ?? 0;
  const days = (steps: OwnerWorkflowStep[]) => steps.reduce((s, st) => s + (st.type === "wait" ? st.days : 0), 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Workflows</h1>
          <p className="text-th-muted text-sm mt-1">
            Multi-step sequences for your tenants — e.g. invoice on the 1st → SMS before due → follow-up if unpaid → alert you.
            Need just one message? Use <Link href="/dashboard/automations" className="text-th-accent hover:text-th-accent">Automations</Link>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {workflows.length > 0 && <RunWorkflowsButton />}
          <Link href="/dashboard/workflows/new" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-th-brand px-4 py-2 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover">
            <Plus className="h-4 w-4" /> New workflow
          </Link>
        </div>
      </div>

      {workflows.length > 0 && (
        <ul className="space-y-3">
          {workflows.map((w) => {
            const steps = (w.steps as unknown as OwnerWorkflowStep[]) ?? [];
            return (
              <li key={w.id} className={`rounded-xl border p-4 ${w.isActive ? "border-th-line bg-th-surface" : "border-th-line bg-th-surface opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-th-brand-soft text-th-accent"><WorkflowIcon className="h-4 w-4" /></span>
                  <Link href={`/dashboard/workflows/${w.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-th-ink hover:text-th-accent">{w.name}</p>
                    <p className="text-xs text-th-muted">{triggerSummary(w.trigger, w.offsetDays)} · {steps.length} steps · {days(steps)} days</p>
                    <p className="mt-2 text-xs text-th-faint">
                      <span className="text-th-paid">{countFor(w.id, "active")} in progress</span> · {countFor(w.id, "completed")} finished · {countFor(w.id, "exited")} stopped (paid or removed)
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <WorkflowToggle id={w.id} isActive={w.isActive} apiBase="/api/workflows" />
                    <Link href={`/dashboard/workflows/${w.id}`} className="inline-flex items-center gap-1 text-xs text-th-accent hover:text-th-accent"><Pencil className="h-3 w-3" />Edit</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-th-ink/80">{workflows.length ? "Add from a template" : "Start from a template — you can edit every step"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {OWNER_WORKFLOW_TEMPLATES.map((t) => (
            <Link key={t.key} href={`/dashboard/workflows/new?template=${t.key}`} className="rounded-xl border border-th-line bg-th-surface p-4 transition-colors hover:border-th-accent/40 hover:bg-th-brand-soft">
              <p className="text-sm font-semibold text-th-ink">{t.name}</p>
              <p className="mt-1 text-xs text-th-muted">{t.description}</p>
              <p className="mt-2 text-[11px] text-th-faint">{triggerSummary(t.trigger, t.offsetDays)} · {t.steps.length} steps</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
