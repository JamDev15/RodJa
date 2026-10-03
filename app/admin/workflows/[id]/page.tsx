import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { describeStep, type LeadStatus, type WorkflowStep, type WorkflowTrigger } from "@/lib/workflow-meta";
import { WorkflowBuilder } from "../workflow-builder";
import { RemoveEnrollmentButton } from "./remove-enrollment";

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
        <Link href="/admin/workflows" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-white">{workflow.name}</h1>
      </div>

      <WorkflowBuilder
        initial={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description ?? "",
          isActive: workflow.isActive,
          trigger: workflow.trigger as WorkflowTrigger,
          triggerValue: (workflow.triggerValue ?? "") as LeadStatus | "",
          stopOnConversion: workflow.stopOnConversion,
          steps,
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">People in this workflow</h2>
          <Link href="/admin/signups" className="text-sm text-purple-300 hover:text-purple-200">Add from Signups →</Link>
        </div>
        {workflow.enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">Nobody yet. They&apos;ll appear here when the trigger fires, or when you add them from Signups.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-gray-400">
                  <th className="px-4 py-2">Signup</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Next step</th>
                  <th className="px-4 py-2">Enrolled</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {workflow.enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <p className="text-white">{e.account.ownerName}</p>
                      <p className="text-xs text-gray-500">{e.account.email}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span className={e.status === "active" ? "text-green-400" : e.status === "completed" ? "text-gray-300" : "text-orange-300"}>{e.status}</span>
                      {e.exitReason && <p className="text-xs text-gray-500">{e.exitReason}</p>}
                      {e.lastError && <p className="text-xs text-red-400">{e.lastError}</p>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {e.status === "active" && steps[e.stepIndex] ? (
                        <>
                          {describeStep(steps[e.stepIndex])}
                          <br />
                          <span className="text-gray-500">{when(e.nextRunAt)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">{when(e.enrolledAt)}</td>
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
