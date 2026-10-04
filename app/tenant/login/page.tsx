"use client";
import { AuthShell, Notice, thLabel, thLink, thPrimary } from "@/components/public/ui";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function TenantLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ phone: "", pin: "" });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await signIn("tenant", {
        phone: form.phone,
        pin: form.pin,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid phone number or PIN. Please try again.");
      } else {
        router.push("/tenant/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={<>Tenant <em>portal.</em></>}
      subtitle="Sign in with the phone number and PIN your landlord gave you."
      footer={
        <>
          <p>Forgot your PIN? Ask your landlord to reset it.</p>
          <p className="text-[13px]">
            Are you the owner? <Link href="/login" className={thLink}>Owner sign in</Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="phone" className={thLabel}>Phone number</label>
          <input id="phone" className="th-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <label htmlFor="pin" className={thLabel}>Portal PIN</label>
          <input id="pin" className="th-input tracking-[0.3em]" type="password" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
            value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} required maxLength={12} />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" className={thPrimary} disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
