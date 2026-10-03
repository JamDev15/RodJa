import { logMessage, type LogContext } from "@/lib/message-log";

export function isSmsConfigured(): boolean {
  return !!process.env.SEMAPHORE_API_KEY;
}

/**
 * Sends through Semaphore (PH SMS gateway). When a log context is given the
 * attempt is recorded in Message History — including "not configured" so an
 * owner can see why an SMS they expected never arrived.
 */
export async function sendSMS(to: string, message: string, log?: LogContext): Promise<boolean> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  let ok = false;
  let error: string | null = null;

  if (!apiKey) {
    error = "SMS is not configured on this server";
  } else {
    try {
      const res = await fetch("https://api.semaphore.co/api/v4/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          number: to,
          message,
          sendername: process.env.SEMAPHORE_SENDER_NAME ?? "TENANTHUB",
        }),
      });
      ok = res.ok;
      if (!ok) error = `Semaphore responded ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  if (log) {
    await logMessage({ ...log, channel: "sms", to, body: message, status: ok ? "sent" : "failed", error });
  }
  return ok;
}

export function buildReminderMessage(
  tenantName: string,
  amount: number,
  dueDate: Date,
  trigger: string,
  landlordName: string
): string {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
  const date = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(dueDate);

  if (trigger.includes("before")) {
    const days = trigger.split("days_")[0];
    return `Hi ${tenantName}, your rent of ${formatted} is due on ${date}. Please pay on time. - ${landlordName}`;
  }
  if (trigger === "due_date") {
    return `Hi ${tenantName}, your rent of ${formatted} is due TODAY. Pay now via GCash/Maya. - ${landlordName}`;
  }
  const days = trigger.split("days_")[0];
  return `Hi ${tenantName}, your rent of ${formatted} is ${days} day(s) OVERDUE. Please settle immediately. - ${landlordName}`;
}
