"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [unitLabel, setUnitLabel] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    moveInDate: "", moveOutDate: "",
    depositAmount: "", depositPaid: false,
    portalPin: "", emergencyContact: "", notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetch(`/api/tenants/${tenantId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          moveInDate: data.moveInDate ? data.moveInDate.split("T")[0] : "",
          moveOutDate: data.moveOutDate ? data.moveOutDate.split("T")[0] : "",
          depositAmount: data.depositAmount != null ? String(data.depositAmount) : "",
          depositPaid: data.depositPaid ?? false,
          portalPin: data.portalPin ?? "",
          emergencyContact: data.emergencyContact ?? "",
          notes: data.notes ?? "",
          isActive: data.isActive ?? true,
        });
        setUnitLabel(`${data.unit?.property?.name ?? ""} – Unit ${data.unit?.unitNumber ?? ""}`);
      })
      .finally(() => setFetching(false));
  }, [tenantId]);

  function generatePin() {
    setForm((f) => ({ ...f, portalPin: String(Math.floor(100000 + Math.random() * 900000)) }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
          moveOutDate: form.moveOutDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      toast({ title: "Tenant updated!", variant: "success" });
      router.push(`/dashboard/tenants/${tenantId}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-8 w-48 rounded bg-white/10 animate-pulse mb-6" />
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded bg-white/10 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/tenants/${tenantId}`} className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Tenant</h1>
          <p className="text-gray-400 text-sm">{unitLabel}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">

        {/* Status toggle */}
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Tenant Status</p>
            <p className="text-xs text-gray-500">Inactive tenants cannot log in to the portal</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-green-600" : "bg-gray-600"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Name & Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" placeholder="Juan dela Cruz" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input id="phone" placeholder="09xx-xxx-xxxx" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
        </div>

        {/* Email & PIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" placeholder="juan@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portalPin">Portal PIN *</Label>
            <div className="flex gap-2">
              <Input id="portalPin" placeholder="6-digit PIN" value={form.portalPin}
                onChange={(e) => setForm({ ...form, portalPin: e.target.value })} required maxLength={6} />
              <Button type="button" variant="secondary" onClick={generatePin} className="shrink-0">New PIN</Button>
            </div>
          </div>
        </div>

        {/* Move-in & Move-out */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="moveInDate">Move-in Date *</Label>
            <Input id="moveInDate" type="date" value={form.moveInDate}
              onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moveOutDate">Move-out Date (optional)</Label>
            <Input id="moveOutDate" type="date" value={form.moveOutDate}
              onChange={(e) => setForm({ ...form, moveOutDate: e.target.value })} />
          </div>
        </div>

        {/* Deposit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Deposit Amount (₱)</Label>
            <Input id="depositAmount" type="number" placeholder="5000" value={form.depositAmount}
              onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} min="0" />
          </div>
          <div className="space-y-2">
            <Label>Deposit Status</Label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, depositPaid: !f.depositPaid }))}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.depositPaid
                  ? "border-green-500/40 bg-green-500/20 text-green-400"
                  : "border-white/10 bg-white/5 text-gray-400"
              }`}
            >
              {form.depositPaid ? "✓ Deposit Paid" : "✗ Deposit Not Paid"}
            </button>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-2">
          <Label htmlFor="emergencyContact">Emergency Contact (optional)</Label>
          <Input id="emergencyContact" placeholder="Name – 09xx..." value={form.emergencyContact}
            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" placeholder="Any notes about this tenant..." value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
          <Link href={`/dashboard/tenants/${tenantId}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
