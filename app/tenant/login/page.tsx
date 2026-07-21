"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Phone, Lock } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Home className="h-5 w-5 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Tenant Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in with your phone number and PIN</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                className="pl-9"
                placeholder="09xx-xxx-xxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">Portal PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="pin"
                type="password"
                className="pl-9"
                placeholder="6-digit PIN"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                required
                maxLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-600">
          Don&apos;t know your PIN? Contact your landlord.
        </p>
      </div>
    </div>
  );
}
