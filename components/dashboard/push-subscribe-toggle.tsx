"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Support = "checking" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function PushSubscribeToggle() {
  const [status, setStatus] = useState<Support>("checking");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "unsubscribed");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast({ title: "Push notifications aren't configured on this server", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("subscribed");
      toast({ title: "Push notifications enabled on this device", variant: "success" });
    } catch {
      toast({ title: "Couldn't enable push notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
      toast({ title: "Push notifications turned off on this device" });
    } catch {
      toast({ title: "Couldn't disable push notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-3">
      <div>
        <h2 className="font-semibold text-white">Push Notifications</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Get a real notification on this device when a tenant&apos;s bill is due in 2 days, 1 day, or today —
          in addition to the email reminders above.
        </p>
      </div>

      {status === "checking" && <p className="text-sm text-gray-500">Checking this device...</p>}

      {status === "unsupported" && (
        <p className="text-sm text-gray-500">Push notifications aren&apos;t supported in this browser.</p>
      )}

      {status === "denied" && (
        <p className="text-sm text-gray-500">
          Notifications are blocked for this site in your browser settings. Allow them there to enable this.
        </p>
      )}

      {status === "unsubscribed" && (
        <Button onClick={enable} disabled={loading} size="sm">
          <Bell className="h-4 w-4 mr-1.5" /> {loading ? "Enabling..." : "Enable on this device"}
        </Button>
      )}

      {status === "subscribed" && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <Bell className="h-4 w-4" /> Enabled on this device
          </span>
          <Button onClick={disable} disabled={loading} size="sm" variant="outline">
            <BellOff className="h-4 w-4 mr-1.5" /> Turn off
          </Button>
        </div>
      )}
    </div>
  );
}
