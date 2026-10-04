import { prisma } from "@/lib/prisma";

export type RecipientType = "tenant" | "owner" | "admin" | "lead";
export type MessageChannel = "email" | "sms" | "push" | "in_app";
export type MessageCategory =
  | "reminder"
  | "bill_reminder"
  | "automation"
  | "invoice"
  | "receipt"
  | "contract"
  | "billing"
  | "trial"
  | "welcome"
  | "workflow"
  | "report"
  | "system";

/** Who a message is about — passed alongside any send so it lands in Message History. */
export interface LogContext {
  accountId?: string | null;
  tenantId?: string | null;
  recipientType: RecipientType;
  recipientName?: string | null;
  category: MessageCategory;
}

export interface LogEntry extends LogContext {
  channel: MessageChannel;
  to?: string | null;
  subject?: string | null;
  body: string;
  status: "sent" | "failed";
  error?: string | null;
}

/** Turns an email's HTML into a short plain-text preview for the history list. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--brand-->[\s\S]*?<!--\/brand-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 2000);
}

/**
 * Records one sent (or failed) message. Never throws — a logging failure
 * must not turn a successful send into an error for the caller.
 */
export async function logMessage(entry: LogEntry): Promise<void> {
  try {
    await prisma.messageLog.create({
      data: {
        accountId: entry.accountId ?? null,
        tenantId: entry.tenantId ?? null,
        recipientType: entry.recipientType,
        recipientName: entry.recipientName ?? null,
        channel: entry.channel,
        to: entry.to ?? null,
        subject: entry.subject ?? null,
        body: entry.body.slice(0, 2000),
        category: entry.category,
        status: entry.status,
        error: entry.error ? String(entry.error).slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write MessageLog:", err);
  }
}
