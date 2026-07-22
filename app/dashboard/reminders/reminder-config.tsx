"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Smartphone } from "lucide-react";

interface Props {
  config: any;
  accountId: string;
}

function toCsv(value: unknown, fallback: number[]): string {
  const arr = Array.isArray(value) ? value : fallback;
  return arr.join(", ");
}

function parseCsv(value: string): number[] {
  return value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function ReminderConfig({ config, accountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    smsEnabled: config?.smsEnabled ?? false,
    emailEnabled: config?.emailEnabled ?? true,
    inAppEnabled: config?.inAppEnabled ?? true,
  });
  const [daysBeforeCsv, setDaysBeforeCsv] = useState(toCsv(config?.daysBefore, [7, 3, 1]));
  const [daysAfterCsv, setDaysAfterCsv] = useState(toCsv(config?.daysAfter, [1, 3, 7]));

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch("/api/reminders/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accountId,
          daysBefore: parseCsv(daysBeforeCsv),
          daysAfter: parseCsv(daysAfterCsv),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Reminder settings saved!", variant: "success" });
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const toggleItem = (key: keyof typeof form) => setForm(f => ({ ...f, [key]: !f[key] }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2"><Bell className="h-4 w-4 text-blue-400" />Reminder Channels</h2>

        {[
          { key: "inAppEnabled" as const, icon: Bell, label: "In-App Notifications", desc: "Tenants see reminders in their portal" },
          { key: "emailEnabled" as const, icon: Mail, label: "Email Reminders", desc: "Send email reminders to tenants with email addresses" },
          { key: "smsEnabled" as const, icon: Smartphone, label: "SMS Reminders (Semaphore PH)", desc: "Send SMS via Semaphore. Requires API key in settings." },
        ].map(({ key, icon: Icon, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form[key]}
              onClick={() => toggleItem(key)}
              className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none ${form[key] ? "bg-blue-600" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${form[key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-white">Reminder Schedule</h2>
          <p className="text-sm text-gray-400 mt-1">
            A reminder always goes out on the due date itself. Add extra days below (comma-separated) for
            reminders before it&apos;s due and follow-ups after it&apos;s overdue.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daysBefore">Days before due date</Label>
            <Input id="daysBefore" placeholder="7, 3, 1" value={daysBeforeCsv}
              onChange={(e) => setDaysBeforeCsv(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daysAfter">Days after due date (overdue)</Label>
            <Input id="daysAfter" placeholder="1, 3, 7" value={daysAfterCsv}
              onChange={(e) => setDaysAfterCsv(e.target.value)} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
}
