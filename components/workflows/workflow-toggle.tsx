"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";

export function WorkflowToggle({ id, isActive, apiBase = "/api/admin/workflows" }: { id: string; isActive: boolean; apiBase?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(isActive);
  const [busy, setBusy] = useState(false);
  return (
    <ToggleSwitch
      checked={on}
      disabled={busy}
      label={on ? "Pause workflow" : "Activate workflow"}
      onChange={async (next) => {
        setOn(next);
        setBusy(true);
        const res = await fetch(`${apiBase}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        });
        setBusy(false);
        if (!res.ok) {
          setOn(!next);
          toast({ title: "Couldn't update", variant: "destructive" });
        }
        router.refresh();
      }}
    />
  );
}
