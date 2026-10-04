import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OWNER_WORKFLOW_TEMPLATES } from "@/lib/owner-workflow-meta";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";

export default async function NewOwnerWorkflowPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const t = OWNER_WORKFLOW_TEMPLATES.find((x) => x.key === template);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workflows" className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-th-ink">{t ? t.name : "New workflow"}</h1>
      </div>
      <WorkflowBuilder
        key={template ?? "blank"}
        kind="owner"
        initial={{
          name: t?.name ?? "",
          description: t?.description ?? "",
          isActive: true,
          trigger: t?.trigger ?? "before_due",
          triggerParam: String(t ? t.offsetDays : 3),
          stopFlag: true,
          steps: t
            ? (structuredClone(t.steps) as unknown as Record<string, unknown>[])
            : [{ type: "sms", body: "Hi {{first_name}}, your rent of {{amount_due}} is due on {{due_date}}." }],
        }}
      />
    </div>
  );
}
