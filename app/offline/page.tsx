import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 border border-white/10">
          <WifiOff className="h-7 w-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-white">You&apos;re offline</h1>
        <p className="text-gray-400 text-sm">
          No internet connection right now. Pages you&apos;ve already opened may still be
          available — try going back, or reconnect and reload.
        </p>
      </div>
    </div>
  );
}
