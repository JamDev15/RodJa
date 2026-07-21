"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Home, Zap, Droplets } from "lucide-react";
import { getCurrentMonth, formatCurrency } from "@/lib/utils";

export function AddPaymentButton({ tenantId, rentAmount }: { tenantId: string; rentAmount: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    rentAmount: String(rentAmount),
    electricAmount: "",
    waterAmount: "",
    month: getCurrentMonth(),
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 5).toISOString().split("T")[0],
    status: "approved",
    method: "cash",
    notes: "",
  });

  const rent = parseFloat(form.rentAmount) || 0;
  const electric = parseFloat(form.electricAmount) || 0;
  const water = parseFloat(form.waterAmount) || 0;
  const total = rent + electric + water;

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          month: form.month,
          dueDate: form.dueDate,
          status: form.status,
          method: form.method,
          notes: form.notes,
          amount: total,
          rentAmount: rent || null,
          electricAmount: electric || null,
          waterAmount: water || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Payment recorded!", variant: "success" });
      setOpen(false);
      window.location.reload();
    } catch {
      toast({ title: "Error recording payment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Month & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input type="month" value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
            </div>
          </div>

          {/* Bill Breakdown */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bill Breakdown</p>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Home className="h-3.5 w-3.5 text-blue-400" /> Rent (₱)
              </Label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={form.rentAmount}
                onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Zap className="h-3.5 w-3.5 text-yellow-400" /> Electric Bill (₱)
              </Label>
              <Input
                type="number"
                placeholder="0 (optional)"
                min="0"
                value={form.electricAmount}
                onChange={(e) => setForm({ ...form, electricAmount: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Droplets className="h-3.5 w-3.5 text-cyan-400" /> Water Bill (₱)
              </Label>
              <Input
                type="number"
                placeholder="0 (optional)"
                min="0"
                value={form.waterAmount}
                onChange={(e) => setForm({ ...form, waterAmount: e.target.value })}
              />
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1">
              <span className="text-sm text-gray-400">Total Amount</span>
              <span className="text-lg font-bold text-white">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Method & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  <SelectItem value="maya">Maya</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved (Paid)</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="waived">Waived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || total <= 0}>
              {loading ? "Saving..." : `Record ${formatCurrency(total)}`}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
