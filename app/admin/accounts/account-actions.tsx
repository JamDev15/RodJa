"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Props {
  accountId: string;
  isActive: boolean;
  lifetimeAccess: boolean;
}

export function AccountActions({ accountId, isActive, lifetimeAccess }: Props) {
  const [loading, setLoading] = useState(false);

  async function update(body: Record<string, boolean>, successMessage: string, variant: "success" | "destructive") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: successMessage, variant });
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={isActive ? "destructive" : "success"}
        onClick={() => update({ isActive: !isActive }, isActive ? "Account suspended" : "Account activated", isActive ? "destructive" : "success")}
        disabled={loading}
      >
        {isActive ? "Suspend" : "Activate"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => update({ lifetimeAccess: !lifetimeAccess }, lifetimeAccess ? "Lifetime access revoked" : "Lifetime access granted", "success")}
        disabled={loading}
      >
        {lifetimeAccess ? "Revoke Lifetime" : "Grant Lifetime"}
      </Button>
    </div>
  );
}
