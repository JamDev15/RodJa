"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";
import { ADMIN_BUILDER, OWNER_BUILDER, type BuilderConfig, type BuilderDraft, type StepDef } from "./builder-config";

export type { BuilderDraft } from "./builder-config";

const CONFIGS: Record<"admin" | "owner", BuilderConfig> = { admin: ADMIN_BUILDER, owner: OWNER_BUILDER };
const selectClass = "w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink focus:border-th-accent focus:outline-none";

function AddStep({ steps, onAdd }: { steps: StepDef[]; onAdd: (s: StepDef) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-center py-1">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-7 w-7 items-center justify-center rounded-full border border-th-line bg-th-surface text-th-muted hover:border-th-faint/40 hover:text-th-ink" aria-label="Add step">
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-9 z-10 grid w-60 gap-1 rounded-xl border border-th-line bg-th-surface p-1.5 shadow-xl">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.type} type="button" onClick={() => { onAdd(s); setOpen(false); }} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-th-ink/80 hover:bg-th-raised">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${s.color}`}><Icon className="h-3.5 w-3.5" /></span>{s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Visual, fully editable workflow builder (trigger → steps timeline) shared
 * by the admin CRM and owner workflows. Saving an existing workflow keeps
 * everyone already in it at their current step.
 */
export function WorkflowBuilder({ kind, initial }: { kind: "admin" | "owner"; initial: BuilderDraft }) {
  const cfg = CONFIGS[kind];
  const router = useRouter();
  const [w, setW] = useState<BuilderDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastFocused = useRef<{ index: number; key: string; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const update = (next: BuilderDraft) => { setW(next); setDirty(true); };
  const setStep = (i: number, step: Record<string, unknown>) => update({ ...w, steps: w.steps.map((s, idx) => (idx === i ? step : s)) });
  const insertStep = (at: number, def: StepDef) => update({ ...w, steps: [...w.steps.slice(0, at), structuredClone(def.blank), ...w.steps.slice(at)] });
  const removeStep = (i: number) => update({ ...w, steps: w.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= w.steps.length) return;
    const steps = [...w.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    update({ ...w, steps });
  };

  function insertTag(tag: string) {
    const f = lastFocused.current;
    if (!f) return toast({ title: "Click into a message field first, then pick a tag" });
    const step = w.steps[f.index];
    const value = String(step[f.key] ?? "");
    const start = f.el.selectionStart ?? value.length;
    const end = f.el.selectionEnd ?? value.length;
    setStep(f.index, { ...step, [f.key]: value.slice(0, start) + tag + value.slice(end) });
    requestAnimationFrame(() => { f.el.focus(); f.el.setSelectionRange(start + tag.length, start + tag.length); });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(w.id ? `${cfg.apiBase}/${w.id}` : cfg.apiBase, {
        method: w.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg.toPayload(w)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      setDirty(false);
      toast({ title: w.id ? "Changes saved" : "Workflow created", description: w.id ? "People already in this workflow continue from their current step." : undefined, variant: "success" });
      if (!w.id) router.replace(cfg.detailHref(data.id));
      else router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!w.id) return;
    const res = await fetch(`${cfg.apiBase}/${w.id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ title: data.error ?? "Couldn't duplicate", variant: "destructive" });
    toast({ title: "Copy created (paused)", variant: "success" });
    router.push(cfg.detailHref(data.id));
  }

  async function remove() {
    if (!w.id || !confirm("Delete this workflow? Everyone in it stops immediately.")) return;
    const res = await fetch(`${cfg.apiBase}/${w.id}`, { method: "DELETE" });
    if (res.ok) router.push(cfg.listHref);
    else toast({ title: "Couldn't delete", variant: "destructive" });
  }

  const trigger = cfg.triggers.find((t) => t.value === w.trigger);
  const totalDays = w.steps.reduce((s, st) => s + (st.type === "wait" ? Number(st.days) || 0 : 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <div className="rounded-xl border border-th-line bg-th-surface p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="w-name">Workflow name</Label>
            <Input id="w-name" value={w.name} onChange={(e) => update({ ...w, name: e.target.value })} placeholder="e.g. Monthly collection sequence" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="w-desc">Description <span className="text-th-faint">(optional)</span></Label>
            <Input id="w-desc" value={w.description} onChange={(e) => update({ ...w, description: e.target.value })} />
          </div>
        </div>

        <div>
          <div className={`rounded-xl border p-4 ${cfg.accent.ring}`}>
            <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.accent.soft}`}><Zap className="h-4 w-4" />Trigger — when does it start?</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                className={selectClass}
                value={w.trigger}
                onChange={(e) => {
                  const t = cfg.triggers.find((x) => x.value === e.target.value);
                  const param = t?.param?.kind === "days" ? String(t.param.default) : "";
                  update({ ...w, trigger: e.target.value, triggerParam: param });
                }}
              >
                {cfg.triggers.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {trigger?.param?.kind === "status" && (
                <select className={selectClass} value={w.triggerParam} onChange={(e) => update({ ...w, triggerParam: e.target.value })}>
                  <option value="">Choose status…</option>
                  {trigger.param.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {trigger?.param?.kind === "days" && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={trigger.param.min} max={trigger.param.max} className="w-24" value={w.triggerParam}
                    onChange={(e) => update({ ...w, triggerParam: e.target.value })} aria-label={trigger.param.label} />
                  <span className="text-sm text-th-muted">{trigger.param.label.toLowerCase()}</span>
                </div>
              )}
            </div>
            <p className={`mt-2 text-xs opacity-70 ${cfg.accent.soft}`}>{trigger?.help}</p>
          </div>

          <AddStep steps={cfg.steps} onAdd={(d) => insertStep(0, d)} />

          {w.steps.map((step, i) => {
            const def = cfg.steps.find((s) => s.type === step.type);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <div key={i}>
                <div className="rounded-xl border border-th-line bg-th-surface p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${def.color}`}><Icon className="h-4 w-4" /></span>
                    <span className="text-sm font-medium text-th-ink">{i + 1}. {def.label}</span>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="rounded p-1 text-th-faint hover:bg-th-raised hover:text-th-ink disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === w.steps.length - 1} className="rounded p-1 text-th-faint hover:bg-th-raised hover:text-th-ink disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => removeStep(i)} className="rounded p-1 text-th-faint hover:bg-th-danger-soft hover:text-th-danger" aria-label="Delete step"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  {step.type === "wait" ? (
                    <div className="flex items-center gap-2 text-sm text-th-ink/80">
                      Wait
                      <Input type="number" min={0} max={365} className="w-20" value={Number(step.days) || 0}
                        onChange={(e) => setStep(i, { ...step, days: Math.max(0, Number(e.target.value) || 0) })} />
                      day{Number(step.days) === 1 ? "" : "s"}, then continue
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {def.fields.map((f) => {
                        const value = String(step[f.key] ?? "");
                        const track = (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => {
                          if ("mergeable" in f && f.mergeable) lastFocused.current = { index: i, key: f.key, el: e.currentTarget };
                        };
                        if (f.kind === "select") {
                          return (
                            <select key={f.key} className={selectClass} value={value} onChange={(e) => setStep(i, { ...step, [f.key]: e.target.value })}>
                              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          );
                        }
                        if (f.kind === "text") {
                          return <Input key={f.key} placeholder={f.placeholder} value={value} onFocus={track} onChange={(e) => setStep(i, { ...step, [f.key]: e.target.value })} />;
                        }
                        return (
                          <div key={f.key}>
                            <Textarea rows={f.rows} maxLength={f.maxLength} className="resize-y" value={value} onFocus={track}
                              onChange={(e) => setStep(i, { ...step, [f.key]: e.target.value })} />
                            {f.counter && f.maxLength && <p className="mt-1 text-[11px] text-th-faint">{value.length}/{f.maxLength}</p>}
                          </div>
                        );
                      })}
                      {def.note && <p className="text-[11px] text-th-faint">{def.note}</p>}
                    </div>
                  )}
                </div>
                <AddStep steps={cfg.steps} onAdd={(d) => insertStep(i + 1, d)} />
              </div>
            );
          })}
          <div className="rounded-xl border border-dashed border-th-line p-3 text-center text-xs text-th-faint">
            End of workflow · {w.steps.length} step{w.steps.length === 1 ? "" : "s"} · {totalDays} day{totalDays === 1 ? "" : "s"} total
          </div>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-th-line bg-th-surface p-4 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-th-ink/80">
            Active
            <ToggleSwitch checked={w.isActive} onChange={(v) => update({ ...w, isActive: v })} />
          </label>
          {(cfg.stopAppliesTo?.(w.trigger) ?? true) && (
            <label className="flex items-center justify-between gap-3 text-sm text-th-ink/80" title={cfg.stopHelp}>
              <span>{cfg.stopLabel}</span>
              <ToggleSwitch checked={w.stopFlag} onChange={(v) => update({ ...w, stopFlag: v })} />
            </label>
          )}
          <Button className={`w-full ${cfg.accent.button}`} onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />{saving ? "Saving…" : w.id ? (dirty ? "Save changes" : "Saved") : "Create workflow"}
          </Button>
          {w.id && dirty && <p className="text-center text-[11px] text-th-due">You have unsaved changes</p>}
          {w.id && (
            <div className="flex gap-1">
              <Button variant="ghost" className="flex-1" onClick={duplicate}><Copy className="h-4 w-4" />Duplicate</Button>
              <Button variant="ghost" className="flex-1 text-th-danger hover:text-th-danger" onClick={remove}><Trash2 className="h-4 w-4" />Delete</Button>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-th-line bg-th-surface p-4">
          <p className="mb-2 text-xs font-semibold text-th-muted">Personalize — click a field, then a tag</p>
          <div className="flex flex-wrap gap-1">
            {cfg.mergeTags.map((m) => (
              <button key={m.tag} type="button" title={m.desc} onClick={() => insertTag(m.tag)} className={`rounded bg-th-surface px-1.5 py-0.5 font-mono text-[11px] hover:bg-th-raised ${cfg.accent.text}`}>{m.tag}</button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
