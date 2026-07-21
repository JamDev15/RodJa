"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Upload, CheckCircle } from "lucide-react";
import { formatCurrency, getCurrentMonth } from "@/lib/utils";

interface PaymentInfo {
  rentAmount: number;
  currentPayment: { id: string; status: string; month: string } | null;
  account: { gcashNumber: string | null; mayaNumber: string | null; bankDetails: string | null };
}

export default function TenantPayPage() {
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState("gcash");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/payment-info").then(r => r.json()).then(setInfo);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!file) { toast({ title: "Please upload a proof image", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("method", method);
      formData.append("month", getCurrentMonth());
      const res = await fetch("/api/tenant/pay", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
      toast({ title: "Payment submitted!", description: "Your landlord will verify it shortly.", variant: "success" });
    } catch {
      toast({ title: "Error submitting payment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3 pb-20">
        <CheckCircle className="h-16 w-16 text-green-400" />
        <h2 className="text-xl font-bold text-white">Payment Submitted!</h2>
        <p className="text-gray-400 text-center text-sm">Your landlord will review and approve your payment shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white">Upload Payment Proof</h1>
        <p className="text-gray-400 text-sm">Take a screenshot of your payment and upload it here</p>
      </div>

      {/* Amount */}
      {info && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Amount to Pay</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(info.rentAmount)}</p>
        </div>
      )}

      {/* Payment Details */}
      {info && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Send to</p>
          {info.account.gcashNumber && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">GCash</span><span className="font-mono text-white">{info.account.gcashNumber}</span></div>
          )}
          {info.account.mayaNumber && (
            <div className="flex justify-between text-sm"><span className="text-gray-400">Maya</span><span className="font-mono text-white">{info.account.mayaNumber}</span></div>
          )}
          {info.account.bankDetails && (
            <div className="text-sm"><span className="text-gray-400">Bank: </span><span className="text-white">{info.account.bankDetails}</span></div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Payment Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gcash">GCash</SelectItem>
              <SelectItem value="maya">Maya</SelectItem>
              <SelectItem value="bank">Bank Transfer</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Payment Screenshot *</Label>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 p-8 cursor-pointer hover:border-blue-500/50 transition-colors">
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-500" />
                <span className="text-sm text-gray-400">Tap to upload screenshot</span>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFile} className="sr-only" capture="environment" />
          </label>
        </div>

        <Button type="submit" className="w-full" disabled={loading || !file}>
          {loading ? "Submitting..." : "Submit Payment Proof"}
        </Button>
      </form>
    </div>
  );
}
