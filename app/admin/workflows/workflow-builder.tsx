"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clock, Mail, MessageSquare, Plus, Tag, Trash2, Bell, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";
import {
  LEAD_STATUSES,
  WORKFLOW_MERGE_TAGS,
  WORKFLOW_TRIGGERS,
  totalDays,
  type LeadStatus,
  type WorkflowStep,
  type WorkflowTrigger,
} from "@/lib/workflow-meta";

export interface WorkflowDraft {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: WorkflowTrigger;
  triggerValue: LeadStatus | "";
  stopOnConversion: boolean;
  steps: WorkflowStep[];
}

const STEP_TYPES: { type: WorkflowStep["type"]; label: string; icon: typeof Mail; color: string }[] = [
  { type: "wait", label: "Wait", icon: Clock, color: "text-gray-300 bg-white/10" },
  { type: "email", label: "Send email", icon: Mail, color: "text-blue-300 bg-blue-500/15" },
  { type: "sms", label: "Send SMS", icon: MessageSquare, color: "text-emerald-300 bg-emerald-500/15" },
  { type: "set_status", label: "Set lead status", icon: Tag, color: "text-orange-300 bg-orange-500/15" },
  { type: "notify_admin", label: "Notify me", icon: Bell, color: "text-purple-300 bg-purple-500/15" },
];

function blankStep(type: WorkflowStep["type"]): WorkflowStep {
  switch (type) {
    case "wait": return { type, days: 1 };
    case "email": return { type, subject: "", body: "Hi {{first_name}},\n\n" };
    case "sms": return { type, body: "Hi {{first_name}}, " };
    case "set_status": return { type, status: "contacted" };
    case "notify_admin": return { type, subject: "Follow up with {{name}}", body: "{{name}} · {{phone}} · {{email}}" };
  }
}

const selectClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-white focus:border-purple-500 focus:outline-none";

function AddStep({ onAdd }: { onAdd: (t: WorkflowStep["type"]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-center py-1">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#0d1117] text-gray-400 hover:border-purple-500 hover:text-white" aria-label="Add step">
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-9 z-10 grid w-56 gap-1 rounded-xl border border-white/10 bg-[#0f1117] p-1.5 shadow-xl">
          {STEP_TYPES.map(({ type, label, icon: Icon, color }) => (
            <button key={type} type="button" onClick={() => { onAdd(type); setOpen(false); }} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-white/5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-md ${color}`}><Icon className="h-3.5 w-3.5" /></span>{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowBuilder({ initial }: { initial: WorkflowDraft }) {
  const router = useRouter();
  const [w, setW] = useState<WorkflowDraft>(initial);
  const [saving, setSaving] = useState(false);
  const lastFocused = useRef<{ index: number; field: "subject" | "body"; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const setStep = (i: number, step: WorkflowStep) => setW((p) => ({ ...p, steps: p.steps.map((s, idx) => (idx === i ? step : s)) }));
  const insertStep = (at: number, type: WorkflowStep["type"]) =>
    setW((p) => ({ ...p, steps: [...p.steps.slice(0, at), blankStep(type), ...p.steps.slice(at)] }));
  const removeStep = (i: number) => setW((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }));
  const moveStep = (i: number, d: -1 | 1) =>
    setW((p) => {
      const j = i + d;
      if (j < 0 || j >= p.steps.length) return p;
      const steps = [...p.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...p, steps };
    });

  function insertTag(tag: string) {
    const f = lastFocused.current;
    if (!f) return toast({ title: "Click into an email or SMS field first" });
    const step = w.steps[f.index] as any;
    const value: string = step[f.field] ?? "";
    const start = f.el.selectionStart ?? value.length;
    const end = f.el.selectionEnd ?? value.length;
    setStep(f.index, { ...step, [f.field]: value.slice(0, start) + tag + value.slice(end) });
    requestAnimationFrame(() => { f.el.focus(); f.el.setSelectionRange(start + tag.length, start + tag.length); });
  }

  const track = (index: number, field: "subject" | "body") => (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
    lastFocused.current = { index, field, el: e.currentTarget };
  };

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(w.id ? `/api/admin/workflows/${w.id}` : "/api/admin/workflows", {
        method: w.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: w.name,
          description: w.description || null,
          isActive: w.isActive,
          trigger: w.trigger,
          triggerValue: w.trigger === "lead_status" ? w.triggerValue : null,
          stopOnConversion: w.stopOnConversion,
          steps: w.steps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      toast({ title: "Workflow saved", variant: "success" });
      if (!w.id) router.replace(`/admin/workflows/${data.id}`);
      else router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!w.id || !confirm("Delete this workflow? Everyone in it stops immediately.")) return;
    const res = await fetch(`/api/admin/workflows/${w.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/workflows");
    else toast({ title: "Couldn't delete", variant: "destructive" });
  }

  const trigger = WORKFLOW_TRIGGERS.find((t) => t.value === w.trigger);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="w-name">Workflow name</Label>
              <Input id="w-name" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="e.g. Not interested — 30-day nurture" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="w-desc">Description <span className="text-gray-500">(optional)</span></Label>
              <Input id="w-desc" value={w.description} onChange={(e) => setW({ ...w, description: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-purple-200"><Zap className="h-4 w-4" />Trigger</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select className={selectClass} value={w.trigger} onChange={(e) => setW({ ...w, trigger: e.target.value as WorkflowTrigger })}>
                {WORKFLOW_TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {w.trigger === "lead_status" && (
                <select className={selectClass} value={w.triggerValue} onChange={(e) => setW({ ...w, triggerValue: e.target.value as LeadStatus })}>
                  <option value="">Choose status…</option>
                  {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </div>
            <p className="mt-2 text-xs text-purple-200/70">{trigger?.help}</p>
          </div>

          <AddStep onAdd={(t) => insertStep(0, t)} />

          {w.steps.map((step, i) => {
            const meta = STEP_TYPES.find((s) => s.type === step.type)!;
            const Icon = meta.icon;
            return (
              <div key={i}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.color}`}><Icon className="h-4 w-4" /></span>
                    <span className="text-sm font-medium text-white">{i + 1}. {meta.label}</span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === w.steps.length - 1} className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => removeStep(i)} className="rounded p-1 text-gray-500 hover:bg-red-500/20 hover:text-red-400" aria-label="Delete step"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {step.type === "wait" && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      Wait
                      <Input type="number" min={0} max={365} className="w-20" value={step.days} onChange={(e) => setStep(i, { ...step, days: Math.max(0, Number(e.target.value) || 0) })} />
                      day{step.days === 1 ? "" : "s"}, then continue
                    </div>
                  )}
                  {step.type === "email" && (
                    <div className="space-y-2">
                      <Input placeholder="Subject" value={step.subject} onFocus={track(i, "subject")} onChange={(e) => setStep(i, { ...step, subject: e.target.value })} />
                      <Textarea rows={6} className="resize-y" value={step.body} onFocus={track(i, "body")} onChange={(e) => setStep(i, { ...step, body: e.target.value })} />
                      <p className="text-[11px] text-gray-500">An unsubscribe link is added automatically. Skipped for people who unsubscribed.</p>
                    </div>
                  )}
                  {step.type === "sms" && (
                    <div className="space-y-1">
                      <Textarea rows={3} maxLength={450} value={step.body} onFocus={track(i, "body")} onChange={(e) => setStep(i, { ...step, body: e.target.value })} />
                      <p className="text-[11px] text-gray-500">{step.body.length}/450 · Sent to the phone number they signed up with.</p>
                    </div>
                  )}
                  {step.type === "set_status" && (
                    <select className={selectClass} value={step.status} onChange={(e) => setStep(i, { ...step, status: e.target.value as LeadStatus })}>
                      {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                  {step.type === "notify_admin" && (
                    <div className="space-y-2">
                      <Input placeholder="Subject" value={step.subject} onFocus={track(i, "subject")} onChange={(e) => setStep(i, { ...step, subject: e.target.value })} />
                      <Textarea rows={3} value={step.body} onFocus={track(i, "body")} onChange={(e) => setStep(i, { ...step, body: e.target.value })} />
                    </div>
                  )}
                </div>
                <AddStep onAdd={(t) => insertStep(i + 1, t)} />
              </div>
            );
          })}
          <div className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-gray-500">
            End of workflow · {totalDays(w.steps)} day{totalDays(w.steps) === 1 ? "" : "s"} total
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-gray-300">
            Active
            <ToggleSwitch checked={w.isActive} onChange={(v) => setW({ ...w, isActive: v })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-gray-300">
            <span>Stop when they subscribe</span>
            <ToggleSwitch checked={w.stopOnConversion} onChange={(v) => setW({ ...w, stopOnConversion: v })} />
          </label>
          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save workflow"}</Button>
          {w.id && <Button variant="ghost" className="w-full text-red-400 hover:text-red-300" onClick={remove}><Trash2 className="h-4 w-4" />Delete</Button>}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs font-semibold text-gray-400">Personalize — click a field, then a tag</p>
          <div className="flex flex-wrap gap-1">
            {WORKFLOW_MERGE_TAGS.map((m) => (
              <button key={m.tag} type="button" title={m.desc} onClick={() => insertTag(m.tag)} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-purple-300 hover:bg-purple-500/20">{m.tag}</button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
