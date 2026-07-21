"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  paymentId: string;
  proofUrl: string | null;
  tenantName: string;
  amount: number;
}

export function ApprovePaymentButton({ paymentId, proofUrl, tenantName, amount }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectedReason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: action === "approve" ? "Payment approved!" : "Payment rejected",
        variant: action === "approve" ? "success" : "destructive",
      });
      setOpen(false);
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Eye className="h-3.5 w-3.5 mr-1" />Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Payment Proof</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Tenant:</span>
            <span className="text-white font-medium">{tenantName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Amount:</span>
            <span className="text-white font-bold text-lg">{formatCurrency(amount)}</span>
          </div>

          {proofUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Payment Proof:</p>
              <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={proofUrl}
                  alt="Payment proof"
                  className="w-full rounded-lg border border-white/10 max-h-64 object-contain bg-black/20"
                />
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-gray-500 text-sm">
              No proof image uploaded
            </div>
          )}

          {showReject && (
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Explain why this payment is rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!showReject ? (
              <>
                <Button
                  className="flex-1"
                  variant="success"
                  onClick={() => handleAction("approve")}
                  disabled={loading}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowReject(true)}
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleAction("reject")}
                  disabled={loading || !rejectReason}
                >
                  Confirm Rejection
                </Button>
                <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
