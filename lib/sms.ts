export async function sendSMS(to: string, message: string): Promise<boolean> {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        number: to,
        message,
        sendername: process.env.SEMAPHORE_SENDER_NAME ?? "RODJARENT",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
