"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Notice, thHint, thLabel, thPrimary } from "@/components/public/ui";

export function RenewLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/renew/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't sign in");
      router.replace(`/renew?token=${encodeURIComponent(data.token)}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="r-email" className={thLabel}>Email</label>
        <input id="r-email" className="th-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="r-pass" className={thLabel}>Password</label>
        <input id="r-pass" className="th-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" className={thPrimary} disabled={loading}>{loading ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function RenewForm(props: {
  token: string;
  amount: number;
  gcashNumber: string | null;
  gcashQrUrl: string | null;
  mayaNumber: string | null;
  mayaQrUrl: string | null;
}) {
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("token", props.token);
      fd.append("referenceNumber", reference);
      if (proof) fd.append("proof", proof);
      const res = await fetch("/api/renew", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="py-4 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-th-paid" />
        <p className="th-display mt-3 text-[26px] text-th-ink">Payment submitted.</p>
        <p className="mt-2 text-[14px] text-th-muted">We&apos;ll email you a login link as soon as it&apos;s approved — usually within the day.</p>
      </div>
    );
  }

  const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(props.amount);

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-[15px] text-th-muted">Send <strong className="text-th-ink">{peso}</strong> by GCash or Maya, then enter the reference number from your receipt.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {props.gcashNumber && (
          <div>
            <p className={thHint}>GCash</p>
            <p className="tabular text-[15px] font-semibold text-th-ink">{props.gcashNumber}</p>
            {props.gcashQrUrl && <img src={props.gcashQrUrl} alt="GCash QR code" className="mt-2 h-32 w-32 rounded-lg border border-th-line bg-white object-contain" />}
          </div>
        )}
        {props.mayaNumber && (
          <div>
            <p className={thHint}>Maya</p>
            <p className="tabular text-[15px] font-semibold text-th-ink">{props.mayaNumber}</p>
            {props.mayaQrUrl && <img src={props.mayaQrUrl} alt="Maya QR code" className="mt-2 h-32 w-32 rounded-lg border border-th-line bg-white object-contain" />}
          </div>
        )}
      </div>
      {!props.gcashNumber && !props.mayaNumber && <p className="text-[14px] text-th-muted">Payment details aren&apos;t set up yet. Reply to any TenantHub email and we&apos;ll send them.</p>}
      <div className="space-y-2">
        <label htmlFor="r-ref" className={thLabel}>Reference number</label>
        <input id="r-ref" className="th-input tabular" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From your GCash or Maya receipt" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="r-proof" className={thLabel}>Screenshot <span className="font-normal text-th-faint">(optional)</span></label>
        <input id="r-proof" className="th-input file:mr-3 file:rounded-full file:border-0 file:bg-th-raised file:px-3 file:py-1 file:text-[13px] file:text-th-ink" type="file" accept="image/*,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" className={thPrimary} disabled={loading}>{loading ? "Submitting…" : `Submit ${peso} payment`}</button>
    </form>
  );
}
