"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export function EnrollTenants({ workflowId, tenants, disabled }: { workflowId: string; tenants: { id: string; label: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/workflows/${workflowId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantIds: [...picked] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast({ title: data.error ?? "Couldn't add tenants", variant: "destructive" });
    toast({ title: `Started for ${data.started} tenant${data.started === 1 ? "" : "s"}`, description: data.skipped ? `${data.skipped} already started today.` : undefined, variant: "success" });
    setOpen(false);
    setPicked(new Set());
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled || tenants.length === 0} onClick={() => setOpen(true)} title={disabled ? "Turn the workflow on first" : undefined}>
        <UserPlus className="h-3.5 w-3.5" /> Add tenants now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start this workflow for…</DialogTitle>
            <DialogDescription>The first steps run right away, using this month&apos;s bill.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {tenants.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => {
                  const next = new Set(picked);
                  if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                  setPicked(next);
                }} />
                {t.label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={picked.size === 0 || busy} onClick={submit}>{busy ? "Starting…" : `Start for ${picked.size}`}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
