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

export default function EditUnitPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [propertyId, setPropertyId] = useState("");
  const [form, setForm] = useState({
    unitNumber: "", floor: "", rentAmount: "", depositAmount: "", description: "",
  });

  useEffect(() => {
    fetch(`/api/units/${unitId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          unitNumber: data.unitNumber ?? "",
          floor: data.floor ?? "",
          rentAmount: String(data.rentAmount ?? ""),
          depositAmount: String(data.depositAmount ?? ""),
          description: data.description ?? "",
        });
        setPropertyId(data.propertyId ?? "");
      })
      .finally(() => setFetching(false));
  }, [unitId]);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          rentAmount: parseFloat(form.rentAmount),
          depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Unit updated!", variant: "success" });
      router.push(`/dashboard/units/${unitId}`);
    } catch {
      toast({ title: "Error updating unit", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-8 w-48 rounded bg-white/10 animate-pulse mb-6" />
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-white/10 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/units/${unitId}`}
          className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Unit</h1>
          <p className="text-gray-400 text-sm">Update unit details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="unitNumber">Unit Number *</Label>
            <Input
              id="unitNumber"
              placeholder="e.g. 101"
              value={form.unitNumber}
              onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor">Floor (optional)</Label>
            <Input
              id="floor"
              placeholder="e.g. 1st Floor"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rentAmount">Monthly Rent (₱) *</Label>
            <Input
              id="rentAmount"
              type="number"
              placeholder="5000"
              value={form.rentAmount}
              onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
              required
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Deposit Amount (₱)</Label>
            <Input
              id="depositAmount"
              type="number"
              placeholder="5000"
              value={form.depositAmount}
              onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
              min="0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="Describe this unit..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Link href={`/dashboard/units/${unitId}`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
