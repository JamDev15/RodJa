"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface Props {
  accountId: string;
  accountName: string;
  isActive: boolean;
  lifetimeAccess: boolean;
}

export function AccountActions({ accountId, accountName, isActive, lifetimeAccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function update(body: Record<string, boolean>, successMessage: string, variant: "success" | "destructive") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: successMessage, variant });
      window.location.reload();
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Account permanently deleted", variant: "destructive" });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={isActive ? "destructive" : "success"}
        onClick={() => update({ isActive: !isActive }, isActive ? "Account suspended" : "Account activated", isActive ? "destructive" : "success")}
        disabled={loading}
      >
        {isActive ? "Suspend" : "Activate"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => update({ lifetimeAccess: !lifetimeAccess }, lifetimeAccess ? "Lifetime access revoked" : "Lifetime access granted", "success")}
        disabled={loading}
      >
        {lifetimeAccess ? "Revoke Lifetime" : "Grant Lifetime"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmName(""); }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive">Delete</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {accountName}?</DialogTitle>
            <DialogDescription>
              This permanently removes the account and everything tied to it — properties, units, tenants,
              payment history, and billing records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmName">Type <span className="font-semibold text-white">{accountName}</span> to confirm</Label>
            <Input id="confirmName" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmName !== accountName || deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? "Deleting..." : "Permanently Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
