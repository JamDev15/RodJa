"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface Settings {
  gcashNumber: string | null;
  gcashQrUrl: string | null;
  mayaNumber: string | null;
  mayaQrUrl: string | null;
  notificationEmail: string | null;
}

export function PaymentInfoForm({ settings }: { settings: Settings | null }) {
  const [loading, setLoading] = useState(false);
  const [gcashNumber, setGcashNumber] = useState(settings?.gcashNumber ?? "");
  const [mayaNumber, setMayaNumber] = useState(settings?.mayaNumber ?? "");
  const [notificationEmail, setNotificationEmail] = useState(settings?.notificationEmail ?? "");
  const [gcashQr, setGcashQr] = useState<File | null>(null);
  const [mayaQr, setMayaQr] = useState<File | null>(null);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("gcashNumber", gcashNumber);
      formData.append("mayaNumber", mayaNumber);
      formData.append("notificationEmail", notificationEmail);
      if (gcashQr) formData.append("gcashQr", gcashQr);
      if (mayaQr) formData.append("mayaQr", mayaQr);

      const res = await fetch("/api/admin/settings/platform-payment", {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Payment info updated", variant: "success" });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notificationEmail">Notification Email</Label>
        <Input id="notificationEmail" type="email" placeholder="you@realaddress.com" value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)} />
        <p className="text-xs text-gray-500">
          Where &quot;new signup&quot; and &quot;payment submitted&quot; alerts go. Separate from your Super
          Admin login email so it can be an inbox you actually check.
        </p>
      </div>

      <div className="space-y-2 pt-2 border-t border-white/10">
        <Label htmlFor="gcashNumber">GCash Number</Label>
        <Input id="gcashNumber" placeholder="09xx-xxx-xxxx" value={gcashNumber}
          onChange={(e) => setGcashNumber(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="gcashQr">GCash QR Code</Label>
        {settings?.gcashQrUrl && (
          <img src={settings.gcashQrUrl} alt="Current GCash QR" className="h-24 w-24 rounded-lg border border-white/10 object-contain bg-white" />
        )}
        <Input id="gcashQr" type="file" accept="image/*"
          onChange={(e) => setGcashQr(e.target.files?.[0] ?? null)} />
      </div>

      <div className="space-y-2 pt-2 border-t border-white/10">
        <Label htmlFor="mayaNumber">Maya Number</Label>
        <Input id="mayaNumber" placeholder="09xx-xxx-xxxx" value={mayaNumber}
          onChange={(e) => setMayaNumber(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mayaQr">Maya QR Code</Label>
        {settings?.mayaQrUrl && (
          <img src={settings.mayaQrUrl} alt="Current Maya QR" className="h-24 w-24 rounded-lg border border-white/10 object-contain bg-white" />
        )}
        <Input id="mayaQr" type="file" accept="image/*"
          onChange={(e) => setMayaQr(e.target.files?.[0] ?? null)} />
      </div>

      <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Payment Info"}</Button>
    </form>
  );
}
