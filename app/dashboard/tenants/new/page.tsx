"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Unit { id: string; unitNumber: string; property: { name: string } }

export default function NewTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultUnitId = searchParams.get("unitId") ?? "";
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", unitId: defaultUnitId,
    moveInDate: new Date().toISOString().split("T")[0],
    depositAmount: "", portalPin: "", emergencyContact: "", notes: ""
  });

  useEffect(() => {
    fetch("/api/units").then(r => r.json()).then(setUnits);
  }, []);

  // Auto-generate 6-digit PIN
  function generatePin() {
    setForm(f => ({ ...f, portalPin: String(Math.floor(100000 + Math.random() * 900000)) }));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed");
      }
      const data = await res.json();
      toast({ title: "Tenant added!", description: `Portal PIN: ${form.portalPin}`, variant: "success" });
      router.push(`/dashboard/tenants/${data.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tenants" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Tenant</h1>
          <p className="text-gray-400 text-sm">Create a new tenant and assign to a unit</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div className="space-y-2">
          <Label>Assign to Unit *</Label>
          <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
            <SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.property.name} – Unit {u.unitNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" suppressHydrationWarning>
          <div className="space-y-2" suppressHydrationWarning>
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" placeholder="Juan dela Cruz" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required suppressHydrationWarning />
          </div>
          <div className="space-y-2" suppressHydrationWarning>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input id="phone" placeholder="09xx-xxx-xxxx" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} required suppressHydrationWarning />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" placeholder="juan@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moveInDate">Move-in Date *</Label>
            <Input id="moveInDate" type="date" value={form.moveInDate}
              onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} required />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Deposit Amount (₱)</Label>
            <Input id="depositAmount" type="number" placeholder="5000" value={form.depositAmount}
              onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} min="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portalPin">Portal PIN *</Label>
            <div className="flex gap-2">
              <Input id="portalPin" placeholder="6-digit PIN" value={form.portalPin}
                onChange={(e) => setForm({ ...form, portalPin: e.target.value })} required maxLength={6} />
              <Button type="button" variant="secondary" onClick={generatePin} className="shrink-0">Generate</Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyContact">Emergency Contact (optional)</Label>
          <Input id="emergencyContact" placeholder="Name – 09xx..." value={form.emergencyContact}
            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" placeholder="Any notes about this tenant..." value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading || !form.unitId}>{loading ? "Adding..." : "Add Tenant"}</Button>
          <Link href="/dashboard/tenants"><Button type="button" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
