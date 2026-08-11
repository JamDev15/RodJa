"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: "New passwords don't match", variant: "destructive" });
      return;
    }
    if (form.newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Password updated!", variant: "success" });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Error updating password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-white">Change Password</h2>
        <p className="text-xs text-gray-500 mt-0.5">Update the password you use to sign in</p>
      </div>
      <div className="space-y-4 max-w-sm">
        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>New Password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            minLength={8}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>{loading ? "Updating..." : "Update Password"}</Button>
    </form>
  );
}
