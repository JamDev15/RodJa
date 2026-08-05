"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function PlanActions({ planId, isActive }: { planId: string; isActive: boolean }) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isActive ? "Plan deactivated" : "Plan activated", variant: isActive ? "destructive" : "success" });
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant={isActive ? "destructive" : "success"} onClick={toggle} disabled={loading}>
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
