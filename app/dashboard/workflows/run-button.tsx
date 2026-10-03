"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function RunWorkflowsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={running}
      onClick={async () => {
        setRunning(true);
        const res = await fetch("/api/workflows/run", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        setRunning(false);
        if (!res.ok) return toast({ title: "Couldn't run workflows", variant: "destructive" });
        toast({
          title: data.started || data.advanced ? `Started ${data.started}, advanced ${data.advanced}` : "Nothing due right now",
          description: "Each tenant only gets each step once.",
          variant: "success",
        });
        router.refresh();
      }}
    >
      <Play className="h-4 w-4" />{running ? "Running…" : "Run today's now"}
    </Button>
  );
}
