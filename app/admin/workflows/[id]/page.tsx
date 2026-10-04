import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { describeStep, type WorkflowStep } from "@/lib/workflow-meta";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";
import { RemoveEnrollmentButton } from "@/components/workflows/remove-enrollment";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(d);

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { account: { select: { id: true, ownerName: true, email: true, phone: true } } },
        orderBy: { enrolledAt: "desc" },
        take: 200,
      },
    },
  });
  if (!workflow) notFound();
  const steps = (workflow.steps as unknown as WorkflowStep[]) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/workflows" className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-th-ink">{workflow.name}</h1>
      </div>

      <WorkflowBuilder
        kind="admin"
        initial={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description ?? "",
          isActive: workflow.isActive,
          trigger: workflow.trigger,
          triggerParam: workflow.triggerValue ?? "",
          stopFlag: workflow.stopOnConversion,
          steps: steps as unknown as Record<string, unknown>[],
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-th-ink">People in this workflow</h2>
          <Link href="/admin/signups" className="text-sm text-th-violet hover:text-th-violet">Add from Signups →</Link>
        </div>
        {workflow.enrollments.length === 0 ? (
          <p className="text-sm text-th-faint">Nobody yet. They&apos;ll appear here when the trigger fires, or when you add them from Signups.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-th-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-line bg-th-surface text-left text-xs text-th-muted">
                  <th className="px-4 py-2">Signup</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Next step</th>
                  <th className="px-4 py-2">Enrolled</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-th-line">
                {workflow.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <p className="text-th-ink">{e.account.ownerName}</p>
                      <p className="text-xs text-th-faint">{e.account.email}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span className={e.status === "active" ? "text-th-paid" : e.status === "completed" ? "text-th-ink/80" : "text-th-due"}>{e.status}</span>
                      {e.exitReason && <p className="text-xs text-th-faint">{e.exitReason}</p>}
                      {e.lastError && <p className="text-xs text-th-danger">{e.lastError}</p>}
                    </td>
                    <td className="px-4 py-2 text-xs text-th-muted">
                      {e.status === "active" && steps[e.stepIndex] ? (
                        <>
                          {describeStep(steps[e.stepIndex])}
                          <br />
                          <span className="text-th-faint">{when(e.nextRunAt)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-th-muted">{when(e.enrolledAt)}</td>
                    <td className="px-4 py-2 text-right">{e.status === "active" && <RemoveEnrollmentButton id={e.id} />}</td>
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
