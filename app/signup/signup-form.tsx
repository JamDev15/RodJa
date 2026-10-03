"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Home, CheckCircle2, PhoneCall, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PERKS = ["3 days free — no payment needed", "Then just ₱499/month", "Cancel anytime"];

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    ownerName: "",
    phone: "",
    email: "",
    socialMedia: "",
    name: "",
    password: "",
    wantsOnboardingCall: "" as "" | "yes" | "no",
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.wantsOnboardingCall) {
      setError("Please choose whether we can call you for a free onboarding session.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Registration failed");
      try {
        (window as any).fbq?.("track", "StartTrial", { value: 499, currency: "PHP", predicted_ltv: 499 * 12 });
      } catch {}
      router.push("/login?registered=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4" aria-label="TenantHub home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Home className="h-5 w-5 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Start your free 3-day trial</h1>
          <p className="text-gray-400 text-sm mt-1">Full access to every feature. No credit card, no GCash needed to start.</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-400" />{p}</li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-name">Full name *</Label>
            <Input id="s-name" autoComplete="name" placeholder="Juan dela Cruz" value={form.ownerName} onChange={set("ownerName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-phone">Phone number *</Label>
            <Input id="s-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0917 123 4567" value={form.phone} onChange={set("phone")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-email">Email *</Label>
            <Input id="s-email" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-social">Social media account *</Label>
            <Input id="s-social" placeholder="facebook.com/yourname or @yourhandle" value={form.socialMedia} onChange={set("socialMedia")} required />
            <p className="text-xs text-gray-500">Facebook, Instagram, TikTok — whichever you use most.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-biz">Business / property name <span className="text-gray-500">(optional)</span></Label>
            <Input id="s-biz" placeholder="e.g. Santos Apartments" value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-pass">Create a password *</Label>
            <Input id="s-pass" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-white">Can we call you for a free onboarding session? *</legend>
            <p className="text-xs text-gray-500">A quick 15-minute call to set up your properties and tenants with you.</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {([
                { v: "yes", label: "Yes, call me", icon: PhoneCall },
                { v: "no", label: "No, thanks", icon: PhoneOff },
              ] as const).map(({ v, label, icon: Icon }) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    form.wantsOnboardingCall === v ? "border-blue-500 bg-blue-500/15 text-white" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  <input type="radio" name="onboarding" value={v} className="sr-only" checked={form.wantsOnboardingCall === v}
                    onChange={() => setForm({ ...form, wantsOnboardingCall: v })} />
                  <Icon className="h-4 w-4" />{label}
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating your account…" : "Start free trial"}
          </Button>
          <p className="text-center text-xs text-gray-500">
            After 3 days your account pauses until you subscribe. Your data stays safe.
          </p>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
