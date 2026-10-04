"use client";
import { cn } from "@/lib/utils";

/** Small on/off switch matching the existing Reminders settings toggles. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-th-accent disabled:opacity-50",
        checked ? "bg-th-brand" : "bg-th-faint",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform",
          checked ? "translate-x-5 bg-th-on-brand" : "translate-x-0 bg-white"
        )}
      />
    </button>
  );
}
