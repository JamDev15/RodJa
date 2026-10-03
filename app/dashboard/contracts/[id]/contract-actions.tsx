"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ContractActions({ id, status, signLink, tenantHasEmail }: { id: string; status: string; signLink: string; tenantHasEmail: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status !== "sent") return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(signLink);
      toast({ title: "Signing link copied", description: "Paste it into an SMS or Messenger chat with your tenant.", variant: "success" });
    } catch {
      prompt("Copy this signing link:", signLink);
    }
  }

  async function resend() {
    setBusy(true);
    const res = await fetch(`/api/contracts/${id}/resend`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    toast(res.ok ? { title: "Reminder email sent", variant: "success" } : { title: data.error ?? "Couldn't resend", variant: "destructive" });
  }

  async function voidIt() {
    if (!confirm("Void this contract? The tenant's signing link will stop working.")) return;
    setBusy(true);
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else toast({ title: "Couldn't void", variant: "destructive" });
  }

  return (
    <>
      <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" />Copy signing link</Button>
      {tenantHasEmail && <Button variant="outline" onClick={resend} disabled={busy}><Mail className="h-4 w-4" />Resend email</Button>}
      <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={voidIt} disabled={busy}><Ban className="h-4 w-4" />Void</Button>
    </>
  );
}
