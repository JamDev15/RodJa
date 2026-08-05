"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function BillingActions({ recordId }: { recordId: string }) {
  const [loading, setLoading] = useState(false);

  async function review(action: "approve" | "reject") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: action === "approve" ? "Approved — account access restored" : "Rejected — landlord notified to resubmit",
        variant: action === "approve" ? "success" : "destructive",
      });
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="success" onClick={() => review("approve")} disabled={loading}>Approve</Button>
      <Button size="sm" variant="destructive" onClick={() => review("reject")} disabled={loading}>Reject</Button>
    </div>
  );
}
