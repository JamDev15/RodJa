"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, PhoneCall, PhoneOff } from "lucide-react";
import { AuthShell, Notice, thHint, thLabel, thLink, thPrimary } from "@/components/public/ui";

const PERKS = ["3 days free, every feature", "No card or GCash needed", "Then ₱499/month"];

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
    <AuthShell
      width="max-w-lg"
      title={<>Start your <em>free trial.</em></>}
      subtitle={
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {PERKS.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-th-paid" />{p}
            </li>
          ))}
        </ul>
      }
      footer={
        <p>
          Already have an account? <Link href="/login" className={thLink}>Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="s-name" className={thLabel}>Full name</label>
            <input id="s-name" className="th-input" autoComplete="name" placeholder="Juan dela Cruz" value={form.ownerName} onChange={set("ownerName")} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="s-phone" className={thLabel}>Phone number</label>
            <input id="s-phone" className="th-input" type="tel" autoComplete="tel" inputMode="tel" placeholder="0917 123 4567" value={form.phone} onChange={set("phone")} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="s-email" className={thLabel}>Email</label>
            <input id="s-email" className="th-input" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="s-social" className={thLabel}>Social media account</label>
            <input id="s-social" className="th-input" placeholder="facebook.com/yourname or @yourhandle" value={form.socialMedia} onChange={set("socialMedia")} required />
            <p className={thHint}>Facebook, Instagram, or TikTok — whichever you use most.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="s-biz" className={thLabel}>Business name <span className="font-normal text-th-faint">(optional)</span></label>
            <input id="s-biz" className="th-input" placeholder="Santos Apartments" value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-2">
            <label htmlFor="s-pass" className={thLabel}>Create a password</label>
            <input id="s-pass" className="th-input" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
        </div>

        <fieldset className="rounded-xl border border-th-line bg-th-page p-4">
          <legend className="sr-only">Onboarding call</legend>
          <p className={thLabel}>Can we call you for a free setup session?</p>
          <p className={`mt-1 ${thHint}`}>15 minutes on the phone to add your properties and tenants with you.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              { v: "yes", label: "Yes, call me", icon: PhoneCall },
              { v: "no", label: "No, thanks", icon: PhoneOff },
            ] as const).map(({ v, label, icon: Icon }) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-[14px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-th-brand ${
                  form.wantsOnboardingCall === v
                    ? "border-th-brand bg-th-brand-soft text-th-ink"
                    : "border-th-line bg-th-surface text-th-muted hover:text-th-ink"
                }`}
              >
                <input type="radio" name="onboarding" value={v} className="sr-only" checked={form.wantsOnboardingCall === v}
                  onChange={() => setForm({ ...form, wantsOnboardingCall: v })} />
                <Icon className="h-4 w-4" />{label}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className={thPrimary} disabled={loading}>
          {loading ? "Creating your account…" : "Start free trial"}
        </button>
        <p className={`text-center ${thHint}`}>After 3 days your account pauses until you subscribe. Your data stays saved.</p>
      </form>
    </AuthShell>
  );
}
