"use client";
import { useState } from "react";
import { Copy, ReceiptText } from "lucide-react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";

type Key = "autoSendReceipts" | "emailOwnerCopies";

function PreferenceRow({ prefKey, initial, icon: Icon, title, desc }: { prefKey: Key; initial: boolean; icon: typeof Copy; title: string; desc: string }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(next: boolean) {
    setOn(next);
    setSaving(true);
    const res = await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [prefKey]: next }),
    });
    setSaving(false);
    if (!res.ok) {
      setOn(!next);
      toast({ title: "Couldn't save", variant: "destructive" });
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-green-400" />
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      <ToggleSwitch checked={on} onChange={change} disabled={saving} label={title} />
    </div>
  );
}

/** Invoice/receipt preferences shown on the Reminders page. */
export function AutoReceiptToggle({ initial, initialOwnerCopies = true }: { initial: boolean; initialOwnerCopies?: boolean }) {
  return (
    <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5 p-5">
      <PreferenceRow prefKey="autoSendReceipts" initial={initial} icon={ReceiptText} title="Automatic receipts"
        desc="Email the tenant a PDF receipt whenever you approve a payment or mark a bill paid." />
      <PreferenceRow prefKey="emailOwnerCopies" initial={initialOwnerCopies} icon={Copy} title="Owner copies"
        desc="Also email me a copy (with the PDF) of every invoice and receipt sent to my tenants." />
    </div>
  );
}
