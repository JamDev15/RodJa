"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Zap, Mail, MessageSquare, Bell, Smartphone, Send, Pencil, Trash2, Play, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";
import {
  AUTOMATION_TEMPLATES,
  MERGE_TAGS,
  describeTrigger,
  type AutomationChannel,
  type AutomationTrigger,
} from "@/lib/automation-meta";

export interface AutomationRow {
  id: string;
  name: string;
  isActive: boolean;
  trigger: string;
  offsetDays: number;
  audience: string;
  channels: string[];
  subject: string;
  message: string;
  onlyUnpaid: boolean;
  lastRunAt: string | null;
  sentCount: number;
}

type FormState = {
  name: string;
  trigger: AutomationTrigger;
  offsetDays: number;
  audience: "tenant" | "owner" | "both";
  channels: AutomationChannel[];
  subject: string;
  message: string;
  onlyUnpaid: boolean;
};

const EMPTY: FormState = {
  name: "",
  trigger: "before_due",
  offsetDays: 3,
  audience: "tenant",
  channels: ["email"],
  subject: "",
  message: "",
  onlyUnpaid: true,
};

const CHANNEL_OPTIONS: { key: AutomationChannel; label: string; icon: typeof Mail; note?: string }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "in_app", label: "Tenant portal", icon: Bell, note: "tenant only" },
  { key: "push", label: "Push to my phone", icon: Smartphone, note: "owner only" },
];

const selectClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-white focus:border-blue-500 focus:outline-none";

export function AutomationsManager({ automations, smsConfigured }: { automations: AutomationRow[]; smsConfigured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  function openNew(templateKey?: string) {
    const t = AUTOMATION_TEMPLATES.find((x) => x.key === templateKey);
    setEditingId(null);
    setForm(t ? { name: t.name, trigger: t.trigger, offsetDays: t.offsetDays, audience: t.audience, channels: [...t.channels], subject: t.subject, message: t.message, onlyUnpaid: t.onlyUnpaid } : EMPTY);
    setOpen(true);
  }

  function openEdit(a: AutomationRow) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      trigger: a.trigger as AutomationTrigger,
      offsetDays: a.offsetDays,
      audience: a.audience as FormState["audience"],
      channels: a.channels as AutomationChannel[],
      subject: a.subject,
      message: a.message,
      onlyUnpaid: a.onlyUnpaid,
    });
    setOpen(true);
  }

  function insertTag(tag: string) {
    const el = messageRef.current;
    if (!el) {
      setForm((f) => ({ ...f, message: f.message + tag }));
      return;
    }
    const start = el.selectionStart ?? form.message.length;
    const end = el.selectionEnd ?? form.message.length;
    const next = form.message.slice(0, start) + tag + form.message.slice(end);
    setForm((f) => ({ ...f, message: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  function toggleChannel(c: AutomationChannel) {
    setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/automations/${editingId}` : "/api/automations", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      toast({ title: editingId ? "Automation updated" : "Automation created", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: AutomationRow, next: boolean) {
    setBusy(a.id);
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    setBusy(null);
    if (!res.ok) toast({ title: "Couldn't update", variant: "destructive" });
    router.refresh();
  }

  async function remove(a: AutomationRow) {
    if (!confirm(`Delete "${a.name}"? This can't be undone.`)) return;
    setBusy(a.id);
    const res = await fetch(`/api/automations/${a.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) toast({ title: "Couldn't delete", variant: "destructive" });
    router.refresh();
  }

  async function sendTest(a: AutomationRow) {
    setBusy(a.id);
    const res = await fetch(`/api/automations/${a.id}/test`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) toast({ title: `Test sent to ${data.sentTo}`, variant: "success" });
    else toast({ title: data.error ?? "Test failed", variant: "destructive" });
  }

  async function runNow() {
    setRunning(true);
    const res = await fetch("/api/automations/run", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRunning(false);
    if (!res.ok) {
      toast({ title: "Couldn't run automations", variant: "destructive" });
      return;
    }
    toast({
      title: data.sent > 0 ? `Sent ${data.sent} message${data.sent === 1 ? "" : "s"}` : "Nothing due to send right now",
      description: data.failed > 0 ? `${data.failed} couldn't be delivered — see Message History.` : undefined,
      variant: data.failed > 0 ? "destructive" : "success",
    });
    router.refresh();
  }

  const isDayOfMonth = form.trigger === "day_of_month";
  const needsDays = form.trigger !== "on_due";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openNew()}><Plus className="h-4 w-4" />New automation</Button>
        {automations.length > 0 && (
          <Button variant="outline" onClick={runNow} disabled={running}>
            <Play className="h-4 w-4" />{running ? "Running…" : "Run today's now"}
          </Button>
        )}
      </div>

      {!smsConfigured && (
        <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">
          SMS sending isn&apos;t switched on for this server yet, so SMS steps will show as failed in Message History.
          Email, portal, and push work now.
        </p>
      )}

      {automations.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Start from a ready-made automation:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {AUTOMATION_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => openNew(t.key)}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/10"
              >
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {describeTrigger(t.trigger, t.offsetDays)} · to {t.audience === "both" ? "tenant + you" : t.audience === "owner" ? "you" : "tenant"}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <li key={a.id} className={`rounded-xl border p-4 transition-colors ${a.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-70"}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.isActive ? "bg-blue-600/20 text-blue-400" : "bg-white/5 text-gray-500"}`}>
                  <Zap className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{a.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{describeTrigger(a.trigger, a.offsetDays)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-gray-300">
                      {a.audience === "owner" ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {a.audience === "both" ? "Tenant + me" : a.audience === "owner" ? "Me" : "Tenant"}
                    </span>
                    {a.channels.map((c) => (
                      <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-gray-400">
                        {CHANNEL_OPTIONS.find((o) => o.key === c)?.label ?? c}
                      </span>
                    ))}
                    {a.onlyUnpaid && <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-orange-300">unpaid only</span>}
                    <span className="text-gray-500">· {a.sentCount} sent</span>
                  </div>
                </div>
                <ToggleSwitch checked={a.isActive} disabled={busy === a.id} onChange={(v) => toggleActive(a, v)} label={`Turn ${a.name} ${a.isActive ? "off" : "on"}`} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-white/5 pt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => sendTest(a)} disabled={busy === a.id}><Send className="h-3.5 w-3.5" />Send me a test</Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => remove(a)} disabled={busy === a.id}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit automation" : "New automation"}</DialogTitle>
            <DialogDescription>Runs every morning and sends once per tenant per bill month.</DialogDescription>
          </DialogHeader>

          {!editingId && (
            <div className="mb-4">
              <Label className="text-xs text-gray-500">Start from a template (optional)</Label>
              <select className={`${selectClass} mt-1`} defaultValue="" onChange={(e) => e.target.value && openNew(e.target.value)}>
                <option value="">— Blank —</option>
                {AUTOMATION_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-name">Name</Label>
              <Input id="a-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 3-day rent reminder" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-trigger">When</Label>
                <select id="a-trigger" className={selectClass} value={form.trigger}
                  onChange={(e) => {
                    const trigger = e.target.value as AutomationTrigger;
                    setForm({ ...form, trigger, offsetDays: trigger === "day_of_month" ? 1 : trigger === "on_due" ? 0 : form.offsetDays || 3 });
                  }}>
                  <option value="before_due">Days before rent is due</option>
                  <option value="on_due">On the due date</option>
                  <option value="after_due">Days after due date (overdue)</option>
                  <option value="day_of_month">On a day of every month</option>
                  <option value="lease_end">Days before the lease ends</option>
                </select>
              </div>
              {needsDays && (
                <div className="space-y-2">
                  <Label htmlFor="a-days">{isDayOfMonth ? "Day of month (1–31)" : "Number of days"}</Label>
                  <Input id="a-days" type="number" min={isDayOfMonth ? 1 : 0} max={isDayOfMonth ? 31 : 365} value={form.offsetDays}
                    onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} />
                </div>
              )}
            </div>
            {form.trigger === "lease_end" && (
              <p className="text-xs text-gray-500">Uses the tenant&apos;s move-out date, or the end date of their latest signed contract.</p>
            )}

            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["tenant", "owner", "both"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setForm({ ...form, audience: v })}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${form.audience === v ? "border-blue-500 bg-blue-500/15 text-white" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}>
                    {v === "tenant" ? "Tenant" : v === "owner" ? "Me (owner)" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="grid grid-cols-2 gap-2">
                {CHANNEL_OPTIONS.map(({ key, label, icon: Icon, note }) => {
                  const on = form.channels.includes(key);
                  return (
                    <button key={key} type="button" onClick={() => toggleChannel(key)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${on ? "border-blue-500 bg-blue-500/15 text-white" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {note && <span className="text-[10px] text-gray-500">{note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-subject">Subject / title</Label>
              <Input id="a-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Rent reminder: {{amount_due}} due {{due_date}}" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-message">Message</Label>
              <Textarea id="a-message" ref={messageRef} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map((m) => (
                  <button key={m.tag} type="button" title={m.desc} onClick={() => insertTag(m.tag)}
                    className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-blue-300 hover:bg-blue-500/20">
                    {m.tag}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Tap a tag to insert it. SMS uses the message only (max ~450 characters).</p>
            </div>

            {form.trigger !== "after_due" && form.trigger !== "lease_end" && (
              <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-sm text-gray-300">Only send if the tenant still has an unpaid balance</span>
                <ToggleSwitch checked={form.onlyUnpaid} onChange={(v) => setForm({ ...form, onlyUnpaid: v })} />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create automation"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
