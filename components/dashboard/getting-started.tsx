import Link from "next/link";
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";

interface Step {
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export function GettingStarted({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="rounded-xl border border-th-accent/30 bg-th-brand-soft p-6 space-y-4">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-5 w-5 text-th-accent" />
        <div>
          <h2 className="font-semibold text-th-ink">Welcome to TenantHub!</h2>
          <p className="text-sm text-th-muted">
            A few steps to get familiar with the app ({doneCount}/{steps.length} done):
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              step.done
                ? "border-th-line bg-th-surface opacity-60"
                : "border-th-line bg-th-surface hover:bg-th-raised"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-th-paid shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-th-faint shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${step.done ? "text-th-muted line-through" : "text-th-ink"}`}>
                {step.label}
              </p>
              <p className="text-xs text-th-faint">{step.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
