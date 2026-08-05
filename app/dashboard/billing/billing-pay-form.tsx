"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function BillingPayForm() {
  const [loading, setLoading] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("referenceNumber", referenceNumber);
      if (file) formData.append("proof", file);

      const res = await fetch("/api/billing/pay", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Payment submitted — awaiting approval", variant: "success" });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="referenceNumber">Reference Number</Label>
        <Input id="referenceNumber" placeholder="From your GCash/Maya receipt" value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="proof">Screenshot (optional)</Label>
        <Input id="proof" type="file" accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Submitting..." : "Submit Payment"}
      </Button>
    </form>
  );
}
