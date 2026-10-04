import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-th-canvas px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-th-surface border border-th-line">
          <WifiOff className="h-7 w-7 text-th-muted" />
        </div>
        <h1 className="text-xl font-bold text-th-ink">You&apos;re offline</h1>
        <p className="text-th-muted text-sm">
          No internet connection right now. Pages you&apos;ve already opened may still be
          available — try going back, or reconnect and reload.
        </p>
      </div>
    </div>
  );
}
