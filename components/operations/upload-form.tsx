"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink placeholder:text-th-faint focus:border-th-accent focus:outline-none";

type TextField = { name: string; label: string; type?: "text" | "textarea" | "select" | "date" | "month" | "pesos"; hint?: string; required?: boolean; placeholder?: string; options?: { value: string; label: string }[]; defaultValue?: string };

interface Props {
  url: string;
  /** Fixed form values sent with the upload. */
  hidden?: Record<string, string>;
  fields?: TextField[];
  fileLabel?: string;
  /** Shown under the file input. */
  fileHint?: string;
  fileRequired?: boolean;
  accept?: string;
  submitLabel: string;
  toggleLabel?: string;
  successMessage?: string;
  className?: string;
  /** Reset and stay on the page (default) or navigate. */
  redirectTo?: string;
}

/**
 * Multipart form for private uploads (photos, IDs, lease files) and
 * messages with an optional attachment. The server checks the file's
 * content and size; this only gives quick feedback.
 */
export function UploadForm({ url, hidden, fields = [], fileLabel = "File", fileHint = "JPG, PNG, WEBP or PDF, up to 5 MB. Kept private.", fileRequired = true, accept = "image/jpeg,image/png,image/webp,application/pdf", submitLabel, toggleLabel, successMessage, className, redirectTo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(!toggleLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    for (const [k, v] of Object.entries(hidden ?? {})) form.set(k, v);
    const file = form.get("file");
    if (file instanceof File && file.size > 5 * 1024 * 1024) return setError("File is too large (max 5 MB)");
    if (fileRequired && (!(file instanceof File) || file.size === 0)) return setError("Please attach a file");
    for (const f of fields) if (f.required && !String(form.get(f.name) ?? "").trim()) return setError(`${f.label} is required`);
    setBusy(true);
    try {
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not upload");
      if (successMessage) toast({ title: successMessage, variant: "success" });
      formEl.reset();
      if (toggleLabel) setOpen(false);
      if (redirectTo) router.push(redirectTo.replace(":id", data.id ?? ""));
      else router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
        {toggleLabel}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-3 rounded-lg border border-th-line bg-th-surface p-3", className)}>
      {fields.map((f) => (
        <label key={f.name} className="block space-y-1 text-xs font-medium text-th-muted">
          <span>
            {f.label}
            {f.required ? " *" : ""}
          </span>
          {f.type === "textarea" ? (
            <textarea name={f.name} rows={3} placeholder={f.placeholder} defaultValue={f.defaultValue} className={inputClass} />
          ) : f.type === "select" ? (
            <select name={f.name} defaultValue={f.defaultValue} className={inputClass}>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type === "date" || f.type === "month" ? f.type : "text"}
              inputMode={f.type === "pesos" ? "decimal" : undefined}
              placeholder={f.placeholder ?? (f.type === "pesos" ? "0.00" : undefined)}
              defaultValue={f.defaultValue}
              className={inputClass}
            />
          )}
          {f.hint && <span className="block font-normal text-th-faint">{f.hint}</span>}
        </label>
      ))}
      <label className="block space-y-1 text-xs font-medium text-th-muted">
        <span>
          {fileLabel}
          {fileRequired ? " *" : " (optional)"}
        </span>
        <input name="file" type="file" accept={accept} className="block w-full text-sm text-th-ink file:mr-3 file:rounded-md file:border-0 file:bg-th-raised file:px-3 file:py-1.5 file:text-sm" />
        <span className="block font-normal text-th-faint">{fileHint}</span>
      </label>
      {error && (
        <p className="text-sm text-th-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Uploading…" : submitLabel}
        </Button>
        {toggleLabel && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
