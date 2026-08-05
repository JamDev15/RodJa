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
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <PartyPopper className="h-5 w-5 text-blue-400" />
        <div>
          <h2 className="font-semibold text-white">Welcome to TenantHub!</h2>
          <p className="text-sm text-gray-400">
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
                ? "border-white/5 bg-white/5 opacity-60"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-gray-500 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${step.done ? "text-gray-400 line-through" : "text-white"}`}>
                {step.label}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
