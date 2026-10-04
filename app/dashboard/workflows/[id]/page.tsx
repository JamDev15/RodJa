import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeOwnerStep, type OwnerWorkflowStep } from "@/lib/owner-workflow-meta";
import { getMonthLabel } from "@/lib/utils";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { RemoveEnrollmentButton } from "@/components/workflows/remove-enrollment";
import { EnrollTenants } from "./enroll-tenants";

const when = (d: Date) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(d);

export default async function OwnerWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const [workflow, tenants] = await Promise.all([
    prisma.ownerWorkflow.findFirst({
      where: { id, accountId },
      include: {
        enrollments: {
          include: { tenant: { select: { id: true, name: true, unit: { select: { unitNumber: true } } } } },
          orderBy: { enrolledAt: "desc" },
          take: 200,
        },
      },
    }),
    prisma.tenant.findMany({
      where: { isActive: true, unit: { property: { accountId } } },
      select: { id: true, name: true, unit: { select: { unitNumber: true, property: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!workflow) notFound();
  const steps = (workflow.steps as unknown as OwnerWorkflowStep[]) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workflows" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{workflow.name}</h1>
          <p className="text-sm text-gray-400">Edit any step, then save. Tenants already in progress continue from where they are.</p>
        </div>
      </div>

      <WorkflowBuilder
        kind="owner"
        initial={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description ?? "",
          isActive: workflow.isActive,
          trigger: workflow.trigger,
          triggerParam: String(workflow.offsetDays),
          stopFlag: workflow.stopWhenPaid,
          steps: steps as unknown as Record<string, unknown>[],
        }}
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Tenants in this workflow</h2>
          <EnrollTenants
            workflowId={workflow.id}
            disabled={!workflow.isActive}
            tenants={tenants.map((t) => ({ id: t.id, label: `${t.name} — ${t.unit.property.name} Unit ${t.unit.unitNumber}` }))}
          />
        </div>
        {workflow.enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">Nobody yet. Tenants appear here when the trigger fires, or when you add them.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-gray-400">
                  <th className="px-4 py-2">Tenant</th>
                  <th className="px-4 py-2">Bill month</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Next step</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {workflow.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <Link href={`/dashboard/tenants/${e.tenant.id}`} className="text-white hover:text-blue-300">{e.tenant.name}</Link>
                      <p className="text-xs text-gray-500">Unit {e.tenant.unit.unitNumber} · started {when(e.enrolledAt)}</p>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">{getMonthLabel(e.monthKey)}</td>
                    <td className="px-4 py-2">
                      <span className={e.status === "active" ? "text-green-400" : e.status === "completed" ? "text-gray-300" : "text-orange-300"}>
                        {e.status === "active" ? "in progress" : e.status === "completed" ? "finished" : "stopped"}
                      </span>
                      {e.exitReason && e.status !== "completed" && <p className="text-xs text-gray-500">{e.exitReason}</p>}
                      {e.lastError && <p className="text-xs text-yellow-400">{e.lastError}</p>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {e.status === "active" && steps[e.stepIndex] ? (
                        <>{describeOwnerStep(steps[e.stepIndex])}<br /><span className="text-gray-500">{when(e.nextRunAt)}</span></>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">{e.status === "active" && <RemoveEnrollmentButton id={e.id} apiBase="/api/workflows/enrollments" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
