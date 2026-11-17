"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { parsePesos } from "@/lib/collections/money";

const input = "w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base text-th-ink placeholder:text-th-faint focus:border-th-accent focus:outline-none";

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Tenant: upload proof of a full or partial payment. */
export function PaymentProofForm({ suggestedCentavos, today }: { suggestedCentavos: number; today: string }) {
  const router = useRouter();
  // One id per form fill: double taps and retries are recognised as the same submission.
  const [requestId, setRequestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("gcash");
  const [preview, setPreview] = useState<string | null>(null);
  const suggested = useMemo(() => (suggestedCentavos > 0 ? (suggestedCentavos / 100).toFixed(2) : ""), [suggestedCentavos]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (parsePesos(String(form.get("amount") ?? "")) == null) return setError("Enter the amount you paid, e.g. 5000 or 2,500.50");
    form.set("clientRequestId", requestId);
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/billing/payments", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not submit");
      toast({ title: "Payment submitted", description: "It will count toward your balance once it's verified.", variant: "success" });
      (e.target as HTMLFormElement).reset();
      setPreview(null);
      setRequestId(newRequestId());
      router.refresh();
    } catch {
      setError("Network error — please try again. You won't be charged twice for retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-th-line bg-th-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-th-muted">
          Amount paid (₱) *
          <input name="amount" inputMode="decimal" required defaultValue={suggested} className={input} />
        </label>
        <label className="text-xs text-th-muted">
          Date paid *
          <input name="paidOn" type="date" required defaultValue={today} max={today} className={input} />
        </label>
        <label className="text-xs text-th-muted">
          Method
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-xs text-th-muted">
          Reference no.
          <input name="referenceNumber" className={input} placeholder="From your receipt" />
        </label>
      </div>
      <p className="text-xs text-th-faint">You can pay part of the balance — it&apos;s applied to your oldest unpaid charges first.</p>
      <label className="block text-xs text-th-muted">
        Screenshot or photo of the payment {method === "cash" ? "(optional for cash)" : "*"}
        <input
          name="proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required={method !== "cash"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
          }}
          className="mt-1 block w-full text-sm text-th-ink file:mr-3 file:rounded-lg file:border-0 file:bg-th-raised file:px-3 file:py-2 file:text-th-ink"
        />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="Selected proof" className="max-h-48 rounded-lg object-contain" />}
      <input name="notes" placeholder="Note for the office (optional)" className={input} />
      {error && <p className="text-sm text-th-danger" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Uploading…" : "Submit payment"}</Button>
    </form>
  );
}

/** Tenant: upload a VECO electricity receipt. */
export function VecoReceiptForm({ months, defaultMonth }: { months: { value: string; label: string }[]; defaultMonth: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tenant/billing/veco", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Could not upload");
      toast({ title: "VECO receipt uploaded", variant: "success" });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-th-line bg-th-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-th-muted">
          Electricity bill month *
          <select name="billingMonth" defaultValue={defaultMonth} className={input}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-th-muted">
          Amount paid (₱)
          <input name="amount" inputMode="decimal" className={input} placeholder="Optional" />
        </label>
      </div>
      <label className="block text-xs text-th-muted">
        Photo of the VECO receipt *
        <input name="receipt" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block w-full text-sm text-th-ink file:mr-3 file:rounded-lg file:border-0 file:bg-th-raised file:px-3 file:py-2 file:text-th-ink" />
      </label>
      {error && <p className="text-sm text-th-danger" role="alert">{error}</p>}
      <Button type="submit" disabled={busy} variant="outline" className="w-full">{busy ? "Uploading…" : "Upload VECO receipt"}</Button>
    </form>
  );
}
