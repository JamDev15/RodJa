"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4 text-left">
      <div className="space-y-2">
        <Label htmlFor="r-email">Email</Label>
        <Input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-pass">Password</Label>
        <Input id="r-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Checking…" : "Continue"}</Button>
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
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-400" />
        <p className="mt-2 font-semibold text-white">Payment submitted</p>
        <p className="mt-1 text-sm text-gray-400">We&apos;ll email you a login link as soon as it&apos;s approved — usually within the day.</p>
      </div>
    );
  }

  const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(props.amount);

  return (
    <form onSubmit={submit} className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 space-y-4">
      <p className="text-sm text-gray-300">Send <strong className="text-white">{peso}</strong> via GCash or Maya, then enter the reference number from your receipt.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {props.gcashNumber && (
          <div>
            <p className="text-xs text-gray-500">GCash</p>
            <p className="text-white text-sm font-medium">{props.gcashNumber}</p>
            {props.gcashQrUrl && <img src={props.gcashQrUrl} alt="GCash QR code" className="mt-2 h-32 w-32 rounded-lg border border-white/10 bg-white object-contain" />}
          </div>
        )}
        {props.mayaNumber && (
          <div>
            <p className="text-xs text-gray-500">Maya</p>
            <p className="text-white text-sm font-medium">{props.mayaNumber}</p>
            {props.mayaQrUrl && <img src={props.mayaQrUrl} alt="Maya QR code" className="mt-2 h-32 w-32 rounded-lg border border-white/10 bg-white object-contain" />}
          </div>
        )}
      </div>
      {!props.gcashNumber && !props.mayaNumber && <p className="text-sm text-gray-500">Payment details aren&apos;t set up yet — reply to any TenantHub email for help.</p>}
      <div className="space-y-2">
        <Label htmlFor="r-ref">Reference number *</Label>
        <Input id="r-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="From your GCash/Maya receipt" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-proof">Screenshot (optional)</Label>
        <Input id="r-proof" type="file" accept="image/*,application/pdf" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Submitting…" : `Submit ${peso} payment`}</Button>
    </form>
  );
}
