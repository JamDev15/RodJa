"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/collections/calendar";

type View = {
  unitLabel: string;
  readingFrequency: string | null;
  rooms: { unitId: string; unitNumber: string; meterId: string | null; recent: { id: string; readingDate: string; value: string; usage: string | null; overAllowance: boolean; isMeterReset: boolean }[] }[];
};

const input = "w-full rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base text-th-ink focus:border-th-accent focus:outline-none";

/** Room-by-room meter reading entry. Used by caretakers and admins. Shows no money. */
export function MeterEntry({ view, today }: { view: View; today: string }) {
  return (
    <div className="space-y-3">
      {view.readingFrequency && <p className="text-sm text-th-muted">Reading schedule: {view.readingFrequency}</p>}
      {view.rooms.map((r) => (
        <RoomReading key={r.unitId} room={r} unitLabel={view.unitLabel} today={today} />
      ))}
    </div>
  );
}

function RoomReading({ room, unitLabel, today }: { room: View["rooms"][number]; unitLabel: string; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const last = room.recent[0];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/caretaker/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: room.unitId, readingDate: f.get("readingDate"), value: f.get("value"), isMeterReset: f.get("reset") === "on", notes: f.get("notes") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not save" });
      setMsg({ ok: true, text: data.usage != null ? `Saved. Usage since last reading: ${data.usage} ${unitLabel}${data.overAllowance ? " — over the allowance, the office will review it." : "."}` : "Saved as a new baseline." });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-th-line bg-th-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-th-ink">Room {room.unitNumber}</h3>
        <span className="text-xs text-th-muted">{room.meterId ? `Meter ${room.meterId}` : "No meter ID — ask the office"}</span>
      </div>
      <p className="mt-1 text-xs text-th-muted">
        {last ? <>Last reading {last.value} {unitLabel} on {formatDateOnly(last.readingDate)}{last.usage != null ? ` (used ${last.usage})` : ""}</> : "No readings yet — the first one sets the starting point."}
      </p>
      {room.meterId && (
        <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs text-th-muted">
            Reading ({unitLabel})
            <input name="value" inputMode="decimal" required placeholder={last ? `≥ ${last.value}` : "e.g. 123.4"} className={input} />
          </label>
          <label className="text-xs text-th-muted">
            Date
            <input name="readingDate" type="date" required defaultValue={today} max={today} className={input} />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Saving…" : "Save"}</Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-th-muted sm:col-span-3">
            <input type="checkbox" name="reset" className="h-4 w-4" /> Meter replaced or reset (start a new baseline)
          </label>
          <input name="notes" placeholder="Note (optional)" className={`${input} sm:col-span-3`} />
        </form>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-th-paid" : "text-th-danger"}`} role="status">{msg.text}</p>}
    </div>
  );
}
