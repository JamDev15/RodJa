"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewUnitPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    unitNumber: "", floor: "", rentAmount: "", depositAmount: "", description: ""
  });

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, propertyId, rentAmount: parseFloat(form.rentAmount), depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Unit added!", variant: "success" });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch {
      toast({ title: "Error adding unit", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/properties/${propertyId}`} className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Unit</h1>
          <p className="text-gray-400 text-sm">Add a new unit to this property</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="unitNumber">Unit Number *</Label>
            <Input id="unitNumber" placeholder="e.g. 101" value={form.unitNumber}
              onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor">Floor (optional)</Label>
            <Input id="floor" placeholder="e.g. 1st Floor" value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rentAmount">Monthly Rent (₱) *</Label>
            <Input id="rentAmount" type="number" placeholder="5000" value={form.rentAmount}
              onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} required min="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Deposit Amount (₱)</Label>
            <Input id="depositAmount" type="number" placeholder="5000" value={form.depositAmount}
              onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} min="0" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" placeholder="Describe this unit..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Unit"}</Button>
          <Link href={`/dashboard/properties/${propertyId}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
