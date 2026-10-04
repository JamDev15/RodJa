"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, ExternalLink, StickyNote, PhoneCall, Workflow as WorkflowIcon, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { LEAD_STATUSES } from "@/lib/workflow-meta";

export interface SignupRow {
  id: string;
  ownerName: string;
  business: string;
  email: string;
  phone: string | null;
  socialMedia: string | null;
  wantsOnboardingCall: boolean | null;
  leadStatus: string;
  leadNotes: string | null;
  createdAt: string;
  trialLabel: string;
  trialTone: "green" | "red" | "amber" | "blue" | "gray";
  marketingOptOut: boolean;
  workflows: string[];
}

const TONE: Record<SignupRow["trialTone"], string> = {
  green: "bg-th-paid-soft text-th-paid",
  red: "bg-th-danger-soft text-th-danger",
  amber: "bg-th-due-soft text-th-due",
  blue: "bg-th-brand-soft text-th-accent",
  gray: "bg-th-raised text-th-ink/80",
};

function socialHref(v: string): string | null {
  const s = v.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(www\.)?[\w-]+\.(com|ph|net|me|co)\b/i.test(s)) return `https://${s}`;
  return null;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

export function SignupsTable({ rows, workflows }: { rows: SignupRow[]; workflows: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesFor, setNotesFor] = useState<SignupRow | null>(null);
  const [notes, setNotes] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function patch(id: string, data: { leadStatus?: string; leadNotes?: string | null }) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/signups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't save");
      toast({
        title: "Saved",
        description: out.enrolledIn > 0 ? `Started ${out.enrolledIn} workflow${out.enrolledIn === 1 ? "" : "s"} for this signup.` : undefined,
        variant: "success",
      });
      router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function enrollSelected() {
    if (!workflowId) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/admin/workflows/${workflowId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: [...selected] }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Couldn't enroll");
      toast({ title: `Enrolled ${out.enrolled}`, description: out.skipped ? `${out.skipped} already in this workflow.` : undefined, variant: "success" });
      setEnrollOpen(false);
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setEnrolling(false);
    }
  }

  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-th-line p-10 text-center text-sm text-th-faint">No signups match these filters.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-th-muted">
          <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
          Select all ({rows.length})
        </label>
        {selected.size > 0 && (
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setEnrollOpen(true)}>
            <WorkflowIcon className="h-3.5 w-3.5" /> Add {selected.size} to workflow
          </Button>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const status = LEAD_STATUSES.find((s) => s.value === r.leadStatus);
          const href = r.socialMedia ? socialHref(r.socialMedia) : null;
          return (
            <li key={r.id} className={`rounded-xl border p-4 ${selected.has(r.id) ? "border-th-violet/50 bg-th-violet-soft" : "border-th-line bg-th-surface"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1.5" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.ownerName}`} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-th-ink">{r.ownerName}</p>
                    {r.business && <span className="text-sm text-th-faint">· {r.business}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[r.trialTone]}`}>{r.trialLabel}</span>
                    {r.wantsOnboardingCall === true && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-th-paid-soft px-2 py-0.5 text-[11px] font-medium text-th-paid">
                        <PhoneCall className="h-3 w-3" /> Wants a call
                      </span>
                    )}
                    {r.wantsOnboardingCall === false && <span className="rounded-full bg-th-surface px-2 py-0.5 text-[11px] text-th-faint">No call</span>}
                    {r.marketingOptOut && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-th-surface px-2 py-0.5 text-[11px] text-th-faint"><BellOff className="h-3 w-3" />Unsubscribed</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-th-ink/80 hover:text-th-ink"><Mail className="h-3.5 w-3.5 text-th-faint" />{r.email}</a>
                    {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-th-ink/80 hover:text-th-ink"><Phone className="h-3.5 w-3.5 text-th-faint" />{r.phone}</a>}
                    {r.socialMedia && (href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-th-accent hover:text-th-accent">
                        <ExternalLink className="h-3.5 w-3.5" />{r.socialMedia}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-th-ink/80"><ExternalLink className="h-3.5 w-3.5 text-th-faint" />{r.socialMedia}</span>
                    ))}
                  </div>

                  {r.workflows.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.workflows.map((w) => (
                        <span key={w} className="inline-flex items-center gap-1 rounded bg-th-violet-soft px-1.5 py-0.5 text-[11px] text-th-violet"><WorkflowIcon className="h-3 w-3" />{w}</span>
                      ))}
                    </div>
                  )}
                  {r.leadNotes && <p className="whitespace-pre-wrap rounded-lg bg-black/20 px-3 py-2 text-xs text-th-muted">{r.leadNotes}</p>}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-[11px] text-th-faint">{when(r.createdAt)}</span>
                  <select
                    value={r.leadStatus}
                    disabled={savingId === r.id}
                    onChange={(e) => patch(r.id, { leadStatus: e.target.value })}
                    className={`rounded-lg border border-th-line px-2 py-1 text-xs focus:outline-none ${status?.color ?? "bg-th-surface text-th-ink"}`}
                    aria-label="Lead status"
                  >
                    {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value} className="bg-th-surface text-th-ink">{s.label}</option>)}
                  </select>
                  <button onClick={() => { setNotesFor(r); setNotes(r.leadNotes ?? ""); }} className="inline-flex items-center gap-1 text-xs text-th-muted hover:text-th-ink">
                    <StickyNote className="h-3.5 w-3.5" /> {r.leadNotes ? "Edit note" : "Add note"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!notesFor} onOpenChange={(o) => !o && setNotesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {notesFor?.ownerName}</DialogTitle>
            <DialogDescription>Call outcomes, objections, follow-up dates. Only you can see these.</DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesFor(null)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={async () => { if (notesFor) { await patch(notesFor.id, { leadNotes: notes }); setNotesFor(null); } }}>Save note</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selected.size} signup{selected.size === 1 ? "" : "s"} to a workflow</DialogTitle>
            <DialogDescription>The first steps run right away. People already in the workflow are skipped.</DialogDescription>
          </DialogHeader>
          {workflows.length === 0 ? (
            <p className="text-sm text-th-muted">No active workflows yet. Create one in Workflows first.</p>
          ) : (
            <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-sm text-th-ink">
              <option value="">Choose a workflow…</option>
              {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" disabled={!workflowId || enrolling} onClick={enrollSelected}>{enrolling ? "Adding…" : "Add to workflow"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
