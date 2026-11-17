"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { parsePesos } from "@/lib/collections/money";
import { cn } from "@/lib/utils";

export type Field =
  | { name: string; label: string; type: "text" | "date" | "month" | "textarea"; required?: boolean; placeholder?: string; defaultValue?: string; hint?: string; rows?: number }
  | { name: string; label: string; type: "pesos"; required?: boolean; placeholder?: string; defaultValue?: string; hint?: string }
  | { name: string; label: string; type: "number"; required?: boolean; placeholder?: string; defaultValue?: string; hint?: string; step?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string; hint?: string }
  | { name: string; label: string; type: "checkbox"; defaultValue?: boolean; hint?: string };

interface Props {
  url: string;
  method?: "POST" | "DELETE";
  /** Fixed values sent with every submit. */
  body?: Record<string, unknown>;
  fields?: Field[];
  submitLabel: string;
  /** Show a button that opens the form instead of the form itself. */
  toggleLabel?: string;
  variant?: "default" | "outline" | "destructive" | "success" | "secondary";
  size?: "default" | "sm";
  successMessage?: string;
  /** Navigate here after success (otherwise refresh the page). */
  redirectTo?: string;
  className?: string;
  /** Send a per-fill clientRequestId so a double submit is recognised as one. */
  withRequestId?: boolean;
}

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const inputClass =
  "w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink placeholder:text-th-faint focus:border-th-accent focus:outline-none";

/**
 * Small inline form that posts JSON to a collections API route, shows the
 * server's message on failure, and refreshes the page on success. Peso
 * fields (type "pesos") are sent as exact centavos.
 */
export function ActionForm({ url, method = "POST", body, fields = [], submitLabel, toggleLabel, variant = "default", size = "sm", successMessage, redirectTo, className, withRequestId }: Props) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(newRequestId);
  const [open, setOpen] = useState(!toggleLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { ...(body ?? {}), ...(withRequestId ? { clientRequestId: requestId } : {}) };
    for (const f of fields) {
      if (f.type === "checkbox") {
        payload[f.name] = form.get(f.name) === "on";
        continue;
      }
      const raw = String(form.get(f.name) ?? "").trim();
      if (!raw) {
        if ("required" in f && f.required) return setError(`${f.label} is required`);
        payload[f.name] = null;
        continue;
      }
      if (f.type === "pesos") {
        const c = parsePesos(raw);
        if (c == null) return setError(`${f.label}: enter an amount like 1500 or 1,500.50`);
        payload[f.name] = c;
      } else if (f.type === "number") {
        payload[f.name] = Number(raw);
      } else {
        payload[f.name] = raw;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (successMessage) toast({ title: successMessage, variant: "success" });
      if (withRequestId) setRequestId(newRequestId());
      if (toggleLabel) setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant={variant === "default" ? "outline" : variant} size={size} onClick={() => setOpen(true)} className={className}>
        {toggleLabel}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className={cn(fields.length ? "space-y-3 rounded-lg border border-th-line bg-th-surface p-3" : "inline-flex", className)}>
      {fields.map((f) => (
        <div key={f.name} className={f.type === "checkbox" ? "flex items-start gap-2" : "space-y-1"}>
          {f.type === "checkbox" ? (
            <>
              <input id={`${url}-${f.name}`} name={f.name} type="checkbox" defaultChecked={f.defaultValue} className="mt-1 h-4 w-4" />
              <label htmlFor={`${url}-${f.name}`} className="text-sm text-th-ink">
                {f.label}
                {f.hint && <span className="block text-xs text-th-faint">{f.hint}</span>}
              </label>
            </>
          ) : (
            <>
              <label htmlFor={`${url}-${f.name}`} className="block text-xs font-medium text-th-muted">
                {f.label}
                {"required" in f && f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea id={`${url}-${f.name}`} name={f.name} rows={"rows" in f && f.rows ? f.rows : 2} defaultValue={f.defaultValue} placeholder={f.placeholder} className={inputClass} />
              ) : f.type === "select" ? (
                <select id={`${url}-${f.name}`} name={f.name} defaultValue={f.defaultValue} className={inputClass}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${url}-${f.name}`}
                  name={f.name}
                  type={f.type === "pesos" ? "text" : f.type}
                  inputMode={f.type === "pesos" ? "decimal" : undefined}
                  step={f.type === "number" ? f.step : undefined}
                  defaultValue={f.defaultValue}
                  placeholder={f.type === "pesos" ? f.placeholder ?? "0.00" : f.placeholder}
                  className={inputClass}
                />
              )}
              {f.hint && <p className="text-xs text-th-faint">{f.hint}</p>}
            </>
          )}
        </div>
      ))}
      {error && <p className="text-sm text-th-danger" role="alert">{error}</p>}
      <div className={cn("flex flex-wrap gap-2", !fields.length && "items-center")}>
        <Button type="submit" variant={variant} size={size} disabled={busy}>
          {busy ? "Working…" : submitLabel}
        </Button>
        {toggleLabel && (
          <Button type="button" variant="ghost" size={size} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
