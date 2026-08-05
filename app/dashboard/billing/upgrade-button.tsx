"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

export function UpgradeButton({ planId, label }: { planId: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Now pay to activate this plan below", variant: "success" });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleUpgrade} disabled={loading} className="flex items-center justify-center gap-1.5 w-full">
      <Zap className="h-3.5 w-3.5" />
      {loading ? "..." : label}
    </Button>
  );
}
