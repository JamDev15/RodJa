"use client";
import { Suspense, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, Notice, thLabel, thLink, thPrimary } from "@/components/public/ui";

function RegisteredBanner() {
  const params = useSearchParams();
  if (params.get("registered") !== "1") return null;
  return (
    <Notice tone="success">Your 3-day free trial has started. Sign in to set up your first property.</Notice>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("landlord", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      const session = await getSession();
      const role = (session?.user as any)?.role;
      if (role === "SUPER_ADMIN") {
        router.push("/admin/dashboard");
      } else {
        router.push("/dashboard");
      }
    }
  }

  async function handleForgotSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMessage(data.message ?? "If that email is registered, a new password has been sent to it.");
    } catch {
      setForgotMessage("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <AuthShell
      title={mode === "login" ? <>Welcome <em>back.</em></> : <>Reset your <em>password.</em></>}
      subtitle={mode === "login" ? "Sign in to manage your properties and tenants." : "We'll email you a new temporary password."}
      footer={
        <>
          <p>
            New to TenantHub? <Link href="/signup" className={thLink}>Start a free trial</Link>
          </p>
          <p className="text-[13px]">
            Renting from someone? <Link href="/tenant/login" className={thLink}>Open the tenant portal</Link>
          </p>
        </>
      }
    >
      {mode === "login" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className={thLabel}>Email</label>
            <input id="email" type="email" autoComplete="email" className="th-input" placeholder="you@email.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={thLabel}>Password</label>
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(""); setForgotMessage(""); }}
                className={`text-[13px] ${thLink}`}
              >
                Forgot password?
              </button>
            </div>
            <input id="password" type="password" autoComplete="current-password" className="th-input" placeholder="Your password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {!error && (
            <Suspense fallback={null}>
              <RegisteredBanner />
            </Suspense>
          )}
          {error && (
            <Notice tone="error">
              {error}
              <span className="mt-1 block text-[13px] text-th-muted">
                Trial ended or account paused? <Link href="/renew" className={thLink}>Reactivate your account</Link>
              </span>
            </Notice>
          )}
          <button type="submit" className={thPrimary} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleForgotSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="forgotEmail" className={thLabel}>Email</label>
            <input id="forgotEmail" type="email" autoComplete="email" className="th-input" placeholder="you@email.com"
              value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
          </div>
          {forgotMessage && <Notice tone="info">{forgotMessage}</Notice>}
          <button type="submit" className={thPrimary} disabled={forgotLoading}>
            {forgotLoading ? "Sending…" : "Send new password"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("login"); setForgotMessage(""); }}
            className="w-full text-center text-[14px] text-th-muted hover:text-th-ink"
          >
            Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
}
