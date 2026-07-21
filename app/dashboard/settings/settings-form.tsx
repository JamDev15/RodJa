"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Account {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string | null;
  gcashNumber: string | null;
  mayaNumber: string | null;
  bankDetails: string | null;
}

export function SettingsForm({ account }: { account: Account | null }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: account?.name ?? "",
    ownerName: account?.ownerName ?? "",
    phone: account?.phone ?? "",
    gcashNumber: account?.gcashNumber ?? "",
    mayaNumber: account?.mayaNumber ?? "",
    bankDetails: account?.bankDetails ?? "",
  });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Settings saved!", variant: "success" });
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Account Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="font-semibold text-white">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Business/Property Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Owner Name</Label>
            <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Phone Number</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx-xxx-xxxx" />
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-white">Payment Methods</h2>
          <p className="text-xs text-gray-500 mt-0.5">These details will be shown to your tenants in their portal</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>GCash Number</Label>
            <Input value={form.gcashNumber} onChange={(e) => setForm({ ...form, gcashNumber: e.target.value })} placeholder="09xx-xxx-xxxx" />
          </div>
          <div className="space-y-2">
            <Label>Maya Number</Label>
            <Input value={form.mayaNumber} onChange={(e) => setForm({ ...form, mayaNumber: e.target.value })} placeholder="09xx-xxx-xxxx" />
          </div>
          <div className="space-y-2">
            <Label>Bank Account Details</Label>
            <Input value={form.bankDetails} onChange={(e) => setForm({ ...form, bankDetails: e.target.value })} placeholder="BDO – 1234567890 – Juan dela Cruz" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Settings"}</Button>
    </form>
  );
}
