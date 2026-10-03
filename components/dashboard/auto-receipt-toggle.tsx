"use client";
import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";

export function AutoReceiptToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: boolean) {
    setOn(next);
    setSaving(true);
    const res = await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSendReceipts: next }),
    });
    setSaving(false);
    if (!res.ok) {
      setOn(!next);
      toast({ title: "Couldn't save", variant: "destructive" });
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-3">
        <ReceiptText className="mt-0.5 h-4 w-4 text-green-400" />
        <div>
          <p className="text-sm font-medium text-white">Automatic receipts</p>
          <p className="text-xs text-gray-500">
            Email the tenant a PDF receipt whenever you approve a payment or mark a bill paid.
          </p>
        </div>
      </div>
      <ToggleSwitch checked={on} onChange={change} disabled={saving} label="Automatic receipts" />
    </div>
  );
}
