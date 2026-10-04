import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-meta";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";

export default async function NewWorkflowPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const t = WORKFLOW_TEMPLATES.find((x) => x.key === template);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/workflows" className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-th-ink">{t ? t.name : "New workflow"}</h1>
      </div>
      <WorkflowBuilder
        kind="admin"
        initial={{
          name: t?.name ?? "",
          description: t?.description ?? "",
          isActive: true,
          trigger: t?.trigger ?? "manual",
          triggerParam: t?.triggerValue ?? "",
          stopFlag: true,
          steps: t ? (structuredClone(t.steps) as unknown as Record<string, unknown>[]) : [{ type: "email", subject: "", body: "Hi {{first_name}},\n\n" }],
        }}
      />
    </div>
  );
}
