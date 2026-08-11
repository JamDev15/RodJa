"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface TenantCandidate {
  id: string;
  name: string;
}

interface ProposedAction {
  kind: string;
  summary: string;
  data: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: ProposedAction;
  actionState?: "pending" | "confirmed" | "cancelled";
  candidates?: TenantCandidate[];
  sourceText?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: uid(), role: "assistant", text: "Hi! Tell me what to add — e.g. \"add ₱500 electric bill for Juan this month\"." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string, tenantIdHint?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages((m) => [...m, { id: uid(), role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, tenantIdHint }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { id: uid(), role: "assistant", text: json.error || "Something went wrong." }]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: json.reply,
          action: json.action,
          actionState: json.action ? "pending" : undefined,
          candidates: json.clarify?.candidates,
          sourceText: trimmed,
        },
      ]);
    } catch {
      toast({ title: "Couldn't reach the assistant", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(messageId: string, action: ProposedAction) {
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "confirm", action }),
      });
      const json = await res.json();
      setMessages((m) => m.map((msg) => (msg.id === messageId ? { ...msg, actionState: res.ok ? "confirmed" : "pending" } : msg)));
      setMessages((m) => [...m, { id: uid(), role: "assistant", text: res.ok ? json.reply : json.error || "Failed to save." }]);
    } catch {
      toast({ title: "Couldn't reach the assistant", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function cancel(messageId: string) {
    setMessages((m) => m.map((msg) => (msg.id === messageId ? { ...msg, actionState: "cancelled" } : msg)));
    setMessages((m) => [...m, { id: uid(), role: "assistant", text: "Cancelled." }]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors"
        aria-label="Open assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
              <MessageCircle className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-white">Assistant</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "user" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-200"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {msg.action && msg.actionState === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => confirm(msg.id, msg.action!)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Confirm
                      </button>
                      <button
                        onClick={() => cancel(msg.id)}
                        disabled={busy}
                        className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {msg.action && msg.actionState === "confirmed" && (
                    <p className="mt-1 text-xs text-green-400">Confirmed</p>
                  )}
                  {msg.action && msg.actionState === "cancelled" && (
                    <p className="mt-1 text-xs text-gray-500">Cancelled</p>
                  )}

                  {msg.candidates && msg.candidates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.candidates.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => send(msg.sourceText ?? "", c.id)}
                          disabled={busy}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-50"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={busy}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
