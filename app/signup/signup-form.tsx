"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Home, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlatformSettings {
  gcashNumber: string | null;
  gcashQrUrl: string | null;
  mayaNumber: string | null;
  mayaQrUrl: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free — ₱0 (7-day trial)",
  basic: "Basic — ₱199/month",
  pro: "Pro — ₱499/month",
};

function SignupFormInner({ platformSettings }: { platformSettings: PlatformSettings | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", ownerName: "", email: "", password: "", phone: "",
    plan: initialPlan === "basic" || initialPlan === "pro" ? initialPlan : "free",
    referenceNumber: "",
  });
  const [proof, setProof] = useState<File | null>(null);

  const isPaidPlan = form.plan === "basic" || form.plan === "pro";

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (proof) formData.append("proof", proof);

      const res = await fetch("/api/signup", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Registration failed");

      if (data.pendingApproval) {
        setSubmitted(true);
      } else {
        router.push("/login?registered=1");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-7 w-7 text-green-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Payment submitted</h1>
        <p className="text-gray-400 text-sm">
          We received your reference number and it&apos;s awaiting approval. You&apos;ll get an email
          with a login link as soon as it&apos;s confirmed.
        </p>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Back to home</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Home className="h-5 w-5 text-white" />
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-gray-400 text-sm mt-1">
          {isPaidPlan ? "Pay to activate your subscription" : "Start managing your rentals free for 7 days"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Business / Property Name *</Label>
            <Input placeholder="e.g. Santos Apartments" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Your Full Name *</Label>
            <Input placeholder="Juan dela Cruz" value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Email *</Label>
            <Input type="email" placeholder="you@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" placeholder="Min. 8 characters" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input placeholder="09xx-xxx-xxxx" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Plan</Label>
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPaidPlan && (
          <div className="space-y-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-sm text-gray-300">
              Pay via GCash or Maya, then enter your reference number below. Your account activates once
              it&apos;s approved.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {platformSettings?.gcashNumber && (
                <div>
                  <p className="text-xs text-gray-500">GCash</p>
                  <p className="text-white text-sm font-medium">{platformSettings.gcashNumber}</p>
                  {platformSettings.gcashQrUrl && (
                    <img src={platformSettings.gcashQrUrl} alt="GCash QR" className="mt-2 h-28 w-28 rounded-lg border border-white/10 object-contain bg-white" />
                  )}
                </div>
              )}
              {platformSettings?.mayaNumber && (
                <div>
                  <p className="text-xs text-gray-500">Maya</p>
                  <p className="text-white text-sm font-medium">{platformSettings.mayaNumber}</p>
                  {platformSettings.mayaQrUrl && (
                    <img src={platformSettings.mayaQrUrl} alt="Maya QR" className="mt-2 h-28 w-28 rounded-lg border border-white/10 object-contain bg-white" />
                  )}
                </div>
              )}
            </div>
            {!platformSettings?.gcashNumber && !platformSettings?.mayaNumber && (
              <p className="text-sm text-gray-500">Payment details aren&apos;t set up yet — contact support.</p>
            )}
            <div className="space-y-2">
              <Label>Reference Number *</Label>
              <Input placeholder="From your GCash/Maya receipt" value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Screenshot (optional)</Label>
              <Input type="file" accept="image/*,application/pdf"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Submitting..." : isPaidPlan ? "Submit Payment" : "Create Account"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
      </p>
    </div>
  );
}

export function SignupForm({ platformSettings }: { platformSettings: PlatformSettings | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4 py-10">
      <Suspense fallback={null}>
        <SignupFormInner platformSettings={platformSettings} />
      </Suspense>
    </div>
  );
}
