"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "@/hooks/use-toast";
import { defaultContractBody, defaultContractTitle } from "@/lib/contract-template";

export interface TenantOption {
  id: string;
  name: string;
  email: string | null;
  unitNumber: string;
  propertyName: string;
  propertyAddress: string;
  rentAmount: number;
  depositAmount: number | null;
  dueDay: number;
  moveInDate: string; // yyyy-mm-dd
}

export interface DraftValues {
  id?: string;
  tenantId: string;
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
}

const selectClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-base sm:text-sm text-white focus:border-blue-500 focus:outline-none";

function addYear(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ContractEditor({
  tenants,
  owner,
  initial,
  preselectTenantId,
}: {
  tenants: TenantOption[];
  owner: { ownerName: string; businessName: string };
  initial: DraftValues;
  preselectTenantId?: string;
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [v, setV] = useState<DraftValues>(initial);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signedName, setSignedName] = useState(owner.ownerName);
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);

  const tenant = useMemo(() => tenants.find((t) => t.id === v.tenantId), [tenants, v.tenantId]);

  function templateFor(next: DraftValues, t: TenantOption | undefined): string {
    if (!t) return next.body;
    return defaultContractBody({
      ownerName: owner.ownerName,
      businessName: owner.businessName,
      tenantName: t.name,
      propertyName: t.propertyName,
      propertyAddress: t.propertyAddress,
      unitNumber: t.unitNumber,
      monthlyRent: next.monthlyRent ? Number(next.monthlyRent) : null,
      deposit: next.deposit ? Number(next.deposit) : null,
      dueDay: t.dueDay,
      startDate: next.startDate || null,
      endDate: next.endDate || null,
    });
  }

  function pickTenant(id: string) {
    const t = tenants.find((x) => x.id === id);
    if (!t) return setV({ ...v, tenantId: id });
    const startDate = v.startDate || t.moveInDate;
    const next: DraftValues = {
      ...v,
      tenantId: id,
      title: v.title || defaultContractTitle(t.unitNumber),
      startDate,
      endDate: v.endDate || addYear(startDate),
      monthlyRent: v.monthlyRent || String(t.rentAmount),
      deposit: v.deposit || (t.depositAmount != null ? String(t.depositAmount) : ""),
    };
    // Only auto-fill the text when it's still empty — never overwrite edits.
    if (!v.body.trim()) next.body = templateFor(next, t);
    setV(next);
  }

  // Arriving from a tenant's page ("Create contract") pre-fills everything.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselectTenantId && !preselected.current) {
      preselected.current = true;
      pickTenant(preselectTenantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectTenantId]);

  function resetTemplate() {
    if (v.body.trim() && !confirm("Replace the contract text with a fresh template using the details above? Your edits will be lost.")) return;
    setV({ ...v, body: templateFor(v, tenant) });
  }

  function payload() {
    return {
      ...(isNew ? { tenantId: v.tenantId } : {}),
      title: v.title,
      body: v.body,
      startDate: v.startDate || null,
      endDate: v.endDate || null,
      monthlyRent: v.monthlyRent === "" ? null : Number(v.monthlyRent),
      deposit: v.deposit === "" ? null : Number(v.deposit),
    };
  }

  async function saveDraft(silent = false): Promise<string | null> {
    if (!v.tenantId) {
      toast({ title: "Choose a tenant first", variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/contracts" : `/api/contracts/${initial.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      if (!silent) toast({ title: "Draft saved", variant: "success" });
      const id = isNew ? (data.id as string) : initial.id!;
      if (isNew) router.replace(`/dashboard/contracts/${id}`);
      else router.refresh();
      return id;
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function signAndSend() {
    if (!signature) return toast({ title: "Please draw your signature", variant: "destructive" });
    if (!agree) return toast({ title: "Please tick the agreement box", variant: "destructive" });
    if (!confirm("Once you sign and send, the contract text can no longer be edited. Continue?")) return;
    setSending(true);
    try {
      const id = await saveDraft(true);
      if (!id) return;
      const res = await fetch(`/api/contracts/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature, signedName, agree }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send");
      toast({
        title: "Signed and sent ✍️",
        description: data.emailed
          ? `${tenant?.name ?? "The tenant"} got an email with the signing link.`
          : data.hasEmail
          ? "The email failed — copy the signing link and send it another way."
          : "This tenant has no email. It's in their portal, and you can copy the signing link to send by SMS or Messenger.",
        variant: data.emailed ? "success" : "default",
      });
      router.refresh();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function deleteDraft() {
    if (!confirm("Delete this draft?")) return;
    const res = await fetch(`/api/contracts/${initial.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/contracts");
    else toast({ title: "Couldn't delete", variant: "destructive" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-tenant">Tenant</Label>
            {isNew ? (
              <select id="c-tenant" className={selectClass} value={v.tenantId} onChange={(e) => pickTenant(e.target.value)}>
                <option value="">Choose a tenant…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.propertyName} Unit {t.unitNumber}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-white">{tenant ? `${tenant.name} — ${tenant.propertyName} Unit ${tenant.unitNumber}` : "—"}</p>
            )}
            {tenant && !tenant.email && (
              <p className="text-xs text-yellow-400">This tenant has no email on file — they&apos;ll sign from their portal or a link you send them.</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Residential Lease Agreement" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-start">Start date</Label>
            <Input id="c-start" type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-end">End date</Label>
            <Input id="c-end" type="date" value={v.endDate} onChange={(e) => setV({ ...v, endDate: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-rent">Monthly rent (₱)</Label>
            <Input id="c-rent" type="number" min={0} value={v.monthlyRent} onChange={(e) => setV({ ...v, monthlyRent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-dep">Security deposit (₱)</Label>
            <Input id="c-dep" type="number" min={0} value={v.deposit} onChange={(e) => setV({ ...v, deposit: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="c-body">Contract text</Label>
            <button type="button" onClick={resetTemplate} disabled={!tenant} className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40">
              <RotateCcw className="h-3 w-3" /> Use template
            </button>
          </div>
          <Textarea id="c-body" rows={18} className="font-mono text-[13px] leading-relaxed resize-y" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })}
            placeholder={tenant ? "" : "Choose a tenant to start from a ready-made lease template."} />
          <p className="text-xs text-gray-500">
            The template is a starting point, not legal advice — fill in the blanks (____) and adjust to your house rules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => saveDraft()} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save draft"}</Button>
          {!isNew && <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={deleteDraft}><Trash2 className="h-4 w-4" />Delete draft</Button>}
        </div>
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-white">Sign &amp; send to tenant</h2>
          <p className="text-sm text-gray-400 mt-1">You sign first. The tenant then gets a private link to review and sign — no account needed. Both of you get the signed PDF.</p>
        </div>
        <SignaturePad onChange={setSignature} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-name">Your full name</Label>
            <Input id="c-name" value={signedName} onChange={(e) => setSignedName(e.target.value)} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          I agree that my electronic signature is the legal equivalent of my handwritten signature on this contract.
        </label>
        <Button onClick={signAndSend} disabled={sending || saving || !v.tenantId}><Send className="h-4 w-4" />{sending ? "Sending…" : "Sign & send"}</Button>
      </div>
    </div>
  );
}
