"use client";
import { useEffect, useState } from "react";
import {
  Home, LayoutDashboard, Receipt, Settings, Wallet, Users,
  MessageCircle, X, Send, Check, Signal, Wifi, BatteryFull,
} from "lucide-react";

const DEMO_TEXT = "add ₱500 electric bill for Juan";

type Phase = "idle" | "open" | "sent" | "thinking" | "replied" | "confirmed" | "closing";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// A scripted, looping demo of the real chat assistant — not a screenshot,
// so it can't drift out of sync, and it shows the actual save landing on
// the tenant row rather than just claiming it happened.
export function HeroMockup() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [billAdded, setBillAdded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loop() {
      while (mounted) {
        setPhase("idle");
        setTyped("");
        setBillAdded(false);
        await sleep(1800);
        if (!mounted) return;

        setPhase("open");
        await sleep(500);
        for (let i = 1; i <= DEMO_TEXT.length; i++) {
          if (!mounted) return;
          setTyped(DEMO_TEXT.slice(0, i));
          await sleep(30);
        }
        await sleep(500);
        if (!mounted) return;

        setPhase("sent");
        await sleep(700);
        if (!mounted) return;

        setPhase("thinking");
        await sleep(700);
        if (!mounted) return;

        setPhase("replied");
        await sleep(1300);
        if (!mounted) return;

        setPhase("confirmed");
        setBillAdded(true);
        await sleep(2400);
        if (!mounted) return;

        setPhase("closing");
        await sleep(500);
      }
    }
    loop();

    return () => { mounted = false; };
  }, []);

  const chatOpen = phase !== "idle" && phase !== "closing";
  const showUserBubble = phase === "sent" || phase === "thinking" || phase === "replied" || phase === "confirmed";
  const showReply = phase === "replied" || phase === "confirmed";

  return (
    <div className="hidden lg:flex justify-center relative">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[320px] w-[320px] rounded-full bg-blue-600/30 blur-[100px] animate-[glow-pulse_5s_ease-in-out_infinite]" />
      </div>

      <div className="relative w-[300px] rounded-[2.5rem] border-4 border-white/10 bg-[#0d1117] p-3 shadow-2xl shadow-blue-600/20 ring-1 ring-white/5 animate-[float_6s_ease-in-out_infinite]">
        <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute left-1/2 top-3 h-5 w-28 -translate-x-1/2 rounded-full bg-black/60 z-10" />

        <div className="relative rounded-[1.75rem] bg-[#080c14] overflow-hidden pt-2 pb-4 h-[560px]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 mb-3 text-white">
            <span className="text-[9px] font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="h-2.5 w-2.5" />
              <Wifi className="h-2.5 w-2.5" />
              <BatteryFull className="h-3 w-3" />
            </div>
          </div>

          {/* Mini top bar */}
          <div className="flex items-center justify-between px-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600">
                <Home className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs font-bold text-white">TenantHub</span>
            </div>
            <div className="flex gap-1.5">
              <LayoutDashboard className="h-3 w-3 text-blue-400" />
              <Receipt className="h-3 w-3 text-gray-600" />
              <Settings className="h-3 w-3 text-gray-600" />
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2 px-4 mb-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Wallet className="h-2.5 w-2.5 text-blue-400" />
                <p className="text-[9px] text-gray-500">Collected</p>
              </div>
              <p className="text-sm font-bold text-white transition-all">{billAdded ? "₱48,500" : "₱48,000"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-2.5 w-2.5 text-blue-400" />
                <p className="text-[9px] text-gray-500">Tenants</p>
              </div>
              <p className="text-sm font-bold text-white">12</p>
            </div>
          </div>

          {/* Tenant rows */}
          <div className="px-4 space-y-2">
            <div className={`rounded-lg border px-2.5 py-2 transition-colors duration-500 ${billAdded ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-[8px] font-bold text-green-300">JD</div>
                  <div>
                    <p className="text-[10px] font-medium text-white">Juan Dela Cruz</p>
                    <p className="text-[9px] text-gray-500">₱8,000</p>
                  </div>
                </div>
                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-green-400 bg-green-400/10">Paid</span>
              </div>
              {billAdded && (
                <p className="mt-1.5 pl-8 text-[8px] font-medium text-blue-300 opacity-0 animate-[rise-in_0.4s_ease_both]">
                  + ₱500 Electric bill added
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-[8px] font-bold text-yellow-300">MS</div>
                <div>
                  <p className="text-[10px] font-medium text-white">Maria Santos</p>
                  <p className="text-[9px] text-gray-500">₱6,500</p>
                </div>
              </div>
              <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-yellow-400 bg-yellow-400/10">Pending</span>
            </div>
          </div>

          {/* Chat panel — opens/closes as part of the loop */}
          <div
            className={`absolute inset-x-2 bottom-2 origin-bottom-right rounded-2xl border border-white/10 bg-[#0d1117]/95 backdrop-blur-sm shadow-2xl transition-all duration-500 ease-out ${
              chatOpen ? "opacity-100 scale-100 translate-y-0" : "pointer-events-none opacity-0 scale-90 translate-y-4"
            }`}
          >
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600">
                <MessageCircle className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-semibold text-white">Assistant</span>
            </div>

            <div className="p-3 space-y-2">
              <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white/5 px-2.5 py-1.5">
                <p className="text-[9px] text-gray-300">Hi! Tell me what to add.</p>
              </div>

              {showUserBubble && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-2.5 py-1.5">
                    <p className="text-[9px] text-white">{DEMO_TEXT}</p>
                  </div>
                </div>
              )}

              {phase === "thinking" && (
                <div className="flex gap-1 px-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                </div>
              )}

              {showReply && (
                <div className="max-w-[90%] rounded-lg rounded-tl-sm bg-white/5 px-2.5 py-1.5 opacity-0 animate-[rise-in_0.3s_ease_both]">
                  <p className="text-[9px] text-gray-200">
                    Add ₱500 Electric bill for <strong className="text-white">Juan Dela Cruz</strong> — August 2026
                  </p>
                  {phase === "replied" ? (
                    <div className="mt-1.5 flex gap-1.5">
                      <span className="rounded-md bg-green-600 px-2 py-0.5 text-[8px] font-medium text-white">Confirm</span>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[8px] font-medium text-white">Cancel</span>
                    </div>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-[8px] text-green-400">
                      <Check className="h-2.5 w-2.5" /> Confirmed
                    </p>
                  )}
                </div>
              )}
            </div>

            {phase === "open" && (
              <div className="flex items-center gap-1.5 border-t border-white/10 px-2.5 py-2">
                <div className="min-h-[18px] flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] text-gray-300">
                  {typed}
                  <span className="animate-pulse">|</span>
                </div>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600">
                  <Send className="h-3 w-3 text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Toggle bubble */}
          <div className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-600/40">
            {chatOpen ? <X className="h-4 w-4 text-white" /> : <MessageCircle className="h-4 w-4 text-white" />}
          </div>
        </div>
      </div>
    </div>
  );
}
