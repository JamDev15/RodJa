"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Check, X, Zap, Droplets, Home, MoreHorizontal, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface LedgerEntry {
  id: string;
  month: string;
  rentAmount: number;
  rentPaidAmount: number | null;
  rentPaid: boolean;
  electricAmount: number | null;
  electricPaidAmount: number | null;
  electricPaid: boolean;
  waterAmount: number | null;
  waterPaidAmount: number | null;
  waterPaid: boolean;
  otherAmount: number | null;
  otherPaidAmount: number | null;
  otherLabel: string | null;
  otherPaid: boolean;
  balance: number;
  balancePaid: boolean;
  notes: string | null;
}

function getMonths(start: Date): { month: string; label: string }[] {
  const rows: { month: string; label: string }[] = [];
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cur <= last) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    rows.push({ month: key, label: cur.toLocaleDateString("en-PH", { month: "long", year: "numeric" }) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return rows.reverse();
}

// Per-bill balance = billed - paid (0 if paid in full or overpaid)
function billBalance(billed: number | null, paid: number | null, isPaid: boolean): number {
  if (!billed) return 0;
  if (paid != null) return Math.max(0, billed - paid);
  return isPaid ? 0 : billed;
}

function entryTotalBalance(e: LedgerEntry) {
  return (
    billBalance(e.rentAmount, e.rentPaidAmount, e.rentPaid) +
    billBalance(e.electricAmount, e.electricPaidAmount, e.electricPaid) +
    billBalance(e.waterAmount, e.waterPaidAmount, e.waterPaid) +
    billBalance(e.otherAmount, e.otherPaidAmount, e.otherPaid) +
    (e.balancePaid ? 0 : e.balance)
  );
}

// ─── Small bill cell for the table ──────────────────────────────────────────
function BillCell({ billed, paid, isPaid, onToggle }: {
  billed: number | null;
  paid: number | null;
  isPaid: boolean;
  onToggle: () => void;
}) {
  if (!billed) return <span className="text-gray-600 text-xs">—</span>;
  const bal = billBalance(billed, paid, isPaid);
  const partial = paid != null && paid < billed && paid > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-white text-xs">{formatCurrency(billed)}</span>
      {partial && <span className="text-green-400 text-[10px]">paid {formatCurrency(paid!)}</span>}
      {bal > 0
        ? <span className="inline-flex items-center gap-0.5 text-orange-400 text-[10px] font-medium">
            <AlertCircle className="h-2.5 w-2.5" />bal {formatCurrency(bal)}
          </span>
        : <span className="inline-flex items-center gap-1 text-green-400 text-[10px]">
            <Check className="h-2.5 w-2.5" />Paid
          </span>
      }
      {bal > 0 && (
        <button
          onClick={onToggle}
          className="mt-0.5 text-[10px] text-gray-500 hover:text-white underline underline-offset-2 text-left"
        >
          mark paid
        </button>
      )}
    </div>
  );
}

// ─── Bill section inside dialog ──────────────────────────────────────────────
function BillSection({ icon, label, optional, billed, onBilled, paid, onPaid }: {
  icon: React.ReactNode; label: string; optional?: boolean;
  billed: string; onBilled: (v: string) => void;
  paid: string; onPaid: (v: string) => void;
}) {
  const billedNum = parseFloat(billed) || 0;
  const paidNum   = parseFloat(paid) || 0;
  const bal       = billedNum > 0 ? Math.max(0, billedNum - paidNum) : 0;
  const full      = billedNum > 0 && paidNum >= billedNum;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white">{label}</span>
        {optional && <span className="text-xs text-gray-500">(optional)</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Billed (₱)</Label>
          <Input type="number" placeholder="0" min="0" value={billed}
            onChange={(e) => onBilled(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Amount Paid (₱)</Label>
          <Input type="number" placeholder="0" min="0" value={paid}
            onChange={(e) => onPaid(e.target.value)} />
        </div>
      </div>
      {billedNum > 0 && (
        <div className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium ${
          full ? "bg-green-500/10 text-green-400" : paidNum > 0 ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"
        }`}>
          {full ? (
            <span className="flex items-center gap-1"><Check className="h-3 w-3" />Fully paid</span>
          ) : paidNum > 0 ? (
            <>
              <span>Partial — balance</span>
              <span className="font-bold">{formatCurrency(bal)}</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1"><X className="h-3 w-3" />Unpaid</span>
              <span className="font-bold">{formatCurrency(billedNum)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Default form ─────────────────────────────────────────────────────────────
const emptyForm = {
  rentAmount: "", rentPaidAmount: "",
  electricAmount: "", electricPaidAmount: "",
  waterAmount: "", waterPaidAmount: "",
  otherAmount: "", otherPaidAmount: "", otherLabel: "",
  balance: "0", balancePaid: false,
  notes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────
export function TenantLedger({ tenantId, moveInDate, defaultRent }: {
  tenantId: string;
  moveInDate: Date;
  defaultRent: number;
}) {
  const [entries, setEntries] = useState<Map<string, LedgerEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingCarry, setLoadingCarry] = useState(false);
  const [dialogMonth, setDialogMonth] = useState<string | null>(null);
  const [carryBreakdown, setCarryBreakdown] = useState<{ label: string; amount: number }[]>([]);
  const [form, setForm] = useState({ ...emptyForm, rentAmount: String(defaultRent) });

  const allMonths = getMonths(moveInDate);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/ledger?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: LedgerEntry[] = await res.json();
      if (Array.isArray(data)) {
        setEntries(new Map(data.map((e) => [e.month, e])));
      }
    } catch (err) {
      console.error("TenantLedger fetchEntries:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function openDialog(month: string) {
    const entry = entries.get(month);
    if (entry) {
      setForm({
        rentAmount: String(entry.rentAmount),
        rentPaidAmount: entry.rentPaidAmount != null ? String(entry.rentPaidAmount) : "",
        electricAmount: entry.electricAmount != null ? String(entry.electricAmount) : "",
        electricPaidAmount: entry.electricPaidAmount != null ? String(entry.electricPaidAmount) : "",
        waterAmount: entry.waterAmount != null ? String(entry.waterAmount) : "",
        waterPaidAmount: entry.waterPaidAmount != null ? String(entry.waterPaidAmount) : "",
        otherAmount: entry.otherAmount != null ? String(entry.otherAmount) : "",
        otherPaidAmount: entry.otherPaidAmount != null ? String(entry.otherPaidAmount) : "",
        otherLabel: entry.otherLabel ?? "",
        balance: String(entry.balance ?? 0),
        balancePaid: entry.balancePaid ?? false,
        notes: entry.notes ?? "",
      });
      setCarryBreakdown([]);
    } else {
      // New month — auto-load carry from previous month
      const base = { ...emptyForm, rentAmount: String(defaultRent) };
      setForm(base);
      setCarryBreakdown([]);
      autoLoadCarry(month, true);
    }
    setDialogMonth(month);
  }

  async function autoLoadCarry(month: string, silent = false) {
    setLoadingCarry(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, currentMonth: month }),
      });
      const data = await res.json();
      if (data.unpaidTotal > 0) {
        setForm((f) => ({ ...f, balance: String(data.unpaidTotal) }));
        setCarryBreakdown(data.breakdown ?? []);
        if (!silent) toast({
          title: `Balance loaded: ${formatCurrency(data.unpaidTotal)}`,
          description: `From ${data.prevMonth}`,
          variant: "success",
        });
      } else if (!silent) {
        toast({ title: "No unpaid balance from previous month" });
      }
    } catch {
      if (!silent) toast({ title: "Failed to load balance", variant: "destructive" });
    } finally {
      setLoadingCarry(false);
    }
  }

  async function saveEntry() {
    if (!dialogMonth) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, month: dialogMonth, ...form }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchEntries();
      setDialogMonth(null);
      toast({ title: "Saved!", variant: "success" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function patchEntry(month: string, patch: Partial<LedgerEntry>) {
    const entry = entries.get(month);
    if (!entry) return;
    const prev = new Map(entries);
    setEntries(new Map(entries.set(month, { ...entry, ...patch })));
    try {
      const res = await fetch(`/api/ledger/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEntries(prev);
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function deleteEntry(month: string) {
    const entry = entries.get(month);
    if (!entry || !confirm("Delete this month's ledger entry?")) return;
    try {
      await fetch(`/api/ledger/${entry.id}`, { method: "DELETE" });
      await fetchEntries();
      toast({ title: "Deleted", variant: "success" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}</div>;
  }

  const totalOutstanding = allMonths.reduce((sum, { month }) => {
    const e = entries.get(month);
    return sum + (e ? entryTotalBalance(e) : 0);
  }, 0);

  const paidCount = allMonths.filter(({ month }) => {
    const e = entries.get(month);
    return e && entryTotalBalance(e) === 0;
  }).length;

  // Dialog computed totals
  const dRent    = parseFloat(form.rentAmount) || 0;
  const dElec    = parseFloat(form.electricAmount) || 0;
  const dWater   = parseFloat(form.waterAmount) || 0;
  const dOther   = parseFloat(form.otherAmount) || 0;
  const dBalance = parseFloat(form.balance) || 0;
  const dTotal   = dRent + dElec + dWater + dOther + dBalance;
  const dPaid    =
    (parseFloat(form.rentPaidAmount) || 0) +
    (parseFloat(form.electricPaidAmount) || 0) +
    (parseFloat(form.waterPaidAmount) || 0) +
    (parseFloat(form.otherPaidAmount) || 0) +
    (form.balancePaid ? dBalance : 0);
  const dRemaining = Math.max(0, dTotal - dPaid);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
        <span><span className="text-green-400 font-semibold">{paidCount}</span> fully settled</span>
        <span><span className="text-red-400 font-semibold">{allMonths.length - paidCount}</span> with balance</span>
        {totalOutstanding > 0 && (
          <span className="text-orange-400 font-semibold">
            Total outstanding: {formatCurrency(totalOutstanding)}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-gray-400 font-medium text-xs">
              <th className="text-left px-4 py-3 w-32">Month</th>
              <th className="text-left px-4 py-3"><span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />Rent</span></th>
              <th className="text-left px-4 py-3"><span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5" />Electric</span></th>
              <th className="text-left px-4 py-3"><span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />Water</span></th>
              <th className="text-left px-4 py-3">Other</th>
              <th className="text-left px-4 py-3 text-orange-400/80">Carry-over</th>
              <th className="text-left px-4 py-3">Outstanding</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {allMonths.map(({ month, label }) => {
              const e = entries.get(month);
              const isCurrent = month === new Date().toISOString().slice(0, 7);
              const outstanding = e ? entryTotalBalance(e) : null;
              const settled = outstanding === 0 && e != null;

              return (
                <tr key={month} className={`transition-colors ${
                  settled ? "bg-green-500/5 hover:bg-green-500/10"
                  : isCurrent ? "bg-blue-500/5 hover:bg-blue-500/10"
                  : "hover:bg-white/5"
                }`}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-xs">{label}</span>
                      {isCurrent && <span className="text-[10px] text-blue-400">Current</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <BillCell
                      billed={e?.rentAmount ?? null}
                      paid={e?.rentPaidAmount ?? null}
                      isPaid={e?.rentPaid ?? false}
                      onToggle={() => e && patchEntry(month, { rentPaidAmount: e.rentAmount, rentPaid: true })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <BillCell
                      billed={e?.electricAmount ?? null}
                      paid={e?.electricPaidAmount ?? null}
                      isPaid={e?.electricPaid ?? false}
                      onToggle={() => e && patchEntry(month, { electricPaidAmount: e.electricAmount, electricPaid: true })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <BillCell
                      billed={e?.waterAmount ?? null}
                      paid={e?.waterPaidAmount ?? null}
                      isPaid={e?.waterPaid ?? false}
                      onToggle={() => e && patchEntry(month, { waterPaidAmount: e.waterAmount, waterPaid: true })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {e?.otherAmount ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">{e.otherLabel ?? "Other"}</span>
                        <BillCell
                          billed={e.otherAmount}
                          paid={e.otherPaidAmount}
                          isPaid={e.otherPaid}
                          onToggle={() => patchEntry(month, { otherPaidAmount: e.otherAmount, otherPaid: true })}
                        />
                      </div>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  {/* Carry-over balance */}
                  <td className="px-4 py-3">
                    {e && e.balance > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-xs font-medium ${e.balancePaid ? "text-green-400 line-through" : "text-orange-400"}`}>
                          {formatCurrency(e.balance)}
                        </span>
                        {e.balancePaid
                          ? <span className="text-[10px] text-green-400">Cleared</span>
                          : <button
                              onClick={() => patchEntry(month, { balancePaid: true })}
                              className="text-[10px] text-gray-500 hover:text-green-400 underline underline-offset-2 text-left"
                            >mark paid</button>
                        }
                      </div>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  {/* Outstanding */}
                  <td className="px-4 py-3">
                    {e ? (
                      outstanding! > 0
                        ? <span className="text-orange-400 font-semibold text-xs">{formatCurrency(outstanding!)}</span>
                        : <span className="text-green-400 text-xs flex items-center gap-1"><Check className="h-3 w-3" />Settled</span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openDialog(month)}
                        className="flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        {e ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {e ? "Edit" : "Add"}
                      </button>
                      {e && (
                        <button onClick={() => deleteEntry(month)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={!!dialogMonth} onOpenChange={(o) => !o && setDialogMonth(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMonth && new Date(dialogMonth + "-01").toLocaleDateString("en-PH", { month: "long", year: "numeric" })} — Bills
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <BillSection
              icon={<Home className="h-4 w-4 text-blue-400" />} label="Rent"
              billed={form.rentAmount} onBilled={(v) => setForm({ ...form, rentAmount: v })}
              paid={form.rentPaidAmount} onPaid={(v) => setForm({ ...form, rentPaidAmount: v })}
            />
            <BillSection
              icon={<Zap className="h-4 w-4 text-yellow-400" />} label="Electric Bill" optional
              billed={form.electricAmount} onBilled={(v) => setForm({ ...form, electricAmount: v })}
              paid={form.electricPaidAmount} onPaid={(v) => setForm({ ...form, electricPaidAmount: v })}
            />
            <BillSection
              icon={<Droplets className="h-4 w-4 text-cyan-400" />} label="Water Bill" optional
              billed={form.waterAmount} onBilled={(v) => setForm({ ...form, waterAmount: v })}
              paid={form.waterPaidAmount} onPaid={(v) => setForm({ ...form, waterPaidAmount: v })}
            />

            {/* Other */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MoreHorizontal className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-semibold text-white">Other</span>
                <span className="text-xs text-gray-500">(optional)</span>
              </div>
              <Input placeholder="Label (parking, dues...)" value={form.otherLabel}
                onChange={(e) => setForm({ ...form, otherLabel: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Billed (₱)</Label>
                  <Input type="number" placeholder="0" min="0" value={form.otherAmount}
                    onChange={(e) => setForm({ ...form, otherAmount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Paid (₱)</Label>
                  <Input type="number" placeholder="0" min="0" value={form.otherPaidAmount}
                    onChange={(e) => setForm({ ...form, otherPaidAmount: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Carry-over balance */}
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-semibold text-white">Carry-over Balance</span>
                </div>
                <button
                  type="button"
                  onClick={() => dialogMonth && autoLoadCarry(dialogMonth)}
                  disabled={loadingCarry}
                  className="flex items-center gap-1 rounded-md bg-orange-500/20 hover:bg-orange-500/30 px-2.5 py-1 text-xs text-orange-400 font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingCarry ? "animate-spin" : ""}`} />
                  Load from last month
                </button>
              </div>

              {/* Breakdown chips */}
              {carryBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {carryBreakdown.map((b) => (
                    <span key={b.label} className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs text-orange-300">
                      {b.label}: {formatCurrency(b.amount)}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Balance Amount (₱)</Label>
                  <Input type="number" placeholder="0" min="0" value={form.balance}
                    onChange={(e) => setForm({ ...form, balance: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-400">Status</Label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, balancePaid: !f.balancePaid }))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      form.balancePaid
                        ? "border-green-500/40 bg-green-500/20 text-green-400"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-400"
                    }`}
                  >
                    {form.balancePaid ? "✓ Balance Paid" : "⚠ Balance Owed"}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Late payment, partial, etc..." value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>

            {/* Grand total */}
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Total billed</span><span>{formatCurrency(dTotal)}</span>
              </div>
              <div className="flex justify-between text-green-400">
                <span>Total paid</span><span>{formatCurrency(dPaid)}</span>
              </div>
              <div className={`flex justify-between font-bold border-t border-white/10 pt-1.5 ${dRemaining > 0 ? "text-orange-400" : "text-green-400"}`}>
                <span>{dRemaining > 0 ? "Outstanding balance" : "Fully settled"}</span>
                <span>{dRemaining > 0 ? formatCurrency(dRemaining) : "✓"}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveEntry} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setDialogMonth(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
