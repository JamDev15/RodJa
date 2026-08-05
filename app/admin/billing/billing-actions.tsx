"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function BillingActions({ recordId }: { recordId: string }) {
  const [loading, setLoading] = useState(false);

  async function setStatus(status: "paid" | "overdue") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: status === "paid" ? "Marked as paid" : "Marked as overdue", variant: status === "paid" ? "success" : "destructive" });
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="success" onClick={() => setStatus("paid")} disabled={loading}>Mark Paid</Button>
      <Button size="sm" variant="destructive" onClick={() => setStatus("overdue")} disabled={loading}>Mark Overdue</Button>
    </div>
  );
}
