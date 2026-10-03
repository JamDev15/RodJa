import { Resend } from "resend";
import { logMessage, htmlToText, type LogContext } from "@/lib/message-log";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@tenanthub.com";
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");

/** Escapes free-form user text before it's interpolated into an email's HTML body. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(n);
const longDate = (d: Date) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(d);

/** Turns plain text (with newlines) into safe paragraph HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(para)}</p>`)
    .join("");
}

export function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#2563eb;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** When set, the send (and its outcome) is recorded in Message History. */
  log?: LogContext;
}

/**
 * Single choke point for every outgoing email: sends through Resend and,
 * when a log context is given, records the result in MessageLog so owners
 * and the admin can see exactly what went out, to whom, and whether it failed.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  let ok = false;
  let errorText: string | null = null;
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
    });
    if (error) {
      console.error("Resend rejected email:", error);
      errorText = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
    } else {
      ok = true;
    }
  } catch (err) {
    console.error("Failed to send email:", err);
    errorText = err instanceof Error ? err.message : String(err);
  }

  if (opts.log) {
    const attachmentNote = opts.attachments?.length
      ? `\n[Attached: ${opts.attachments.map((a) => a.filename).join(", ")}]`
      : "";
    await logMessage({
      ...opts.log,
      channel: "email",
      to: opts.to,
      subject: opts.subject,
      body: htmlToText(opts.html) + attachmentNote,
      status: ok ? "sent" : "failed",
      error: errorText,
    });
  }
  return ok;
}

/** Shared branded wrapper used by the newer emails. */
export function emailLayout(inner: string, footer = "TenantHub · Rental management made simple"): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#111827;line-height:1.55">
      <!--brand--><div style="padding:18px 0;border-bottom:2px solid #2563eb;margin-bottom:20px">
        <span style="font-weight:700;font-size:18px;color:#2563eb">TenantHub</span>
      </div><!--/brand-->
      ${inner}
      <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px">${footer}</p>
    </div>`;
}

// ─── Tenant-facing ───────────────────────────────────────────────────────────

export async function sendPaymentReminder(
  to: string,
  tenantName: string,
  amount: number,
  dueDate: Date,
  landlordName: string,
  gcash?: string | null,
  maya?: string | null,
  log?: LogContext
): Promise<boolean> {
  const formatted = peso(amount);
  return sendEmail({
    to,
    subject: `Rent Reminder – ${formatted} due`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Rent Payment Reminder</h2>
        <p>Hi <strong>${escapeHtml(tenantName)}</strong>,</p>
        <p>This is a reminder that your rent of <strong>${formatted}</strong>
           is due on <strong>${longDate(dueDate)}</strong>.</p>
        ${gcash ? `<p>GCash: <strong>${escapeHtml(gcash)}</strong></p>` : ""}
        ${maya ? `<p>Maya: <strong>${escapeHtml(maya)}</strong></p>` : ""}
        <p>Please upload your payment proof in your tenant portal after paying.</p>
        <p style="color:#666;font-size:12px">— ${escapeHtml(landlordName)}</p>
      </div>
    `,
  });
}

export async function sendPaymentApproved(
  to: string,
  tenantName: string,
  amount: number,
  month: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Payment Approved – ${month}`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16a34a">Payment Approved ✓</h2>
        <p>Hi <strong>${escapeHtml(tenantName)}</strong>,</p>
        <p>Your payment of <strong>${peso(amount)}</strong> for <strong>${escapeHtml(month)}</strong> has been approved.</p>
        <p>Thank you!</p>
      </div>
    `,
  });
}

export async function sendWelcomeTenant(
  to: string,
  tenantName: string,
  phone: string,
  pin: string,
  portalUrl: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Welcome to your Tenant Portal",
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Welcome, ${escapeHtml(tenantName)}!</h2>
        <p>Your tenant portal is ready. Log in with:</p>
        <ul>
          <li>Phone: <strong>${escapeHtml(phone)}</strong></li>
          <li>PIN: <strong>${escapeHtml(pin)}</strong></li>
        </ul>
        <p><a href="${portalUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Open Portal</a></p>
      </div>
    `,
  });
}

/** "2days_before" | "1day_before" | "due_date" -> a short human phrase. */
function billTriggerPhrase(trigger: string): string {
  if (trigger === "due_date") return "due today";
  if (trigger === "1day_before") return "due tomorrow";
  if (trigger === "2days_before") return "due in 2 days";
  return "due soon";
}

export async function sendOwnerBillReminder(
  to: string,
  ownerName: string,
  tenantName: string,
  billLabel: string,
  amount: number,
  dueDate: Date,
  trigger: string,
  log?: LogContext
): Promise<boolean> {
  const formatted = peso(amount);
  const phrase = billTriggerPhrase(trigger);
  const label = escapeHtml(billLabel);
  return sendEmail({
    to,
    subject: `${billLabel} for ${tenantName} is ${phrase} – ${formatted}`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Bill Reminder</h2>
        <p>Hi ${escapeHtml(ownerName)},</p>
        <p><strong>${escapeHtml(tenantName)}</strong>'s <strong>${label}</strong> of
           <strong>${formatted}</strong> is ${phrase}
           (<strong>${longDate(dueDate)}</strong>).</p>
        <p>This reminder will stop once it's marked paid in the tenant's ledger.</p>
      </div>
    `,
  });
}

export async function sendTenantBillReminder(
  to: string,
  tenantName: string,
  billLabel: string,
  amount: number,
  dueDate: Date,
  trigger: string,
  landlordName: string,
  log?: LogContext
): Promise<boolean> {
  const formatted = peso(amount);
  const phrase = billTriggerPhrase(trigger);
  const label = escapeHtml(billLabel);
  return sendEmail({
    to,
    subject: `${billLabel} ${phrase} – ${formatted}`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">${label} Reminder</h2>
        <p>Hi <strong>${escapeHtml(tenantName)}</strong>,</p>
        <p>Your <strong>${label}</strong> of <strong>${formatted}</strong> is ${phrase}
           (<strong>${longDate(dueDate)}</strong>).</p>
        <p style="color:#666;font-size:12px">— ${escapeHtml(landlordName)}</p>
      </div>
    `,
  });
}

/** Free-form message from an owner automation (subject/body already merge-filled). */
export async function sendAutomationEmail(
  to: string,
  subject: string,
  body: string,
  senderName: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject,
    log,
    html: emailLayout(`${textToHtml(body)}<p style="color:#6b7280;font-size:13px">— ${escapeHtml(senderName)}</p>`),
  });
}

export async function sendInvoiceEmail(opts: {
  to: string;
  tenantName: string;
  ownerName: string;
  kind: "invoice" | "receipt";
  number: string;
  total: number;
  periodLabel: string | null;
  dueDate: Date | null;
  viewUrl: string;
  pdf: Buffer;
  gcash?: string | null;
  maya?: string | null;
  log?: LogContext;
}): Promise<boolean> {
  const isInvoice = opts.kind === "invoice";
  const title = isInvoice ? "Invoice" : "Receipt";
  const period = opts.periodLabel ? ` for ${escapeHtml(opts.periodLabel)}` : "";
  const inner = isInvoice
    ? `
      <h2 style="margin:0 0 12px">${title} ${escapeHtml(opts.number)}</h2>
      <p>Hi <strong>${escapeHtml(opts.tenantName)}</strong>,</p>
      <p>Here is your bill${period}. Amount due: <strong>${peso(opts.total)}</strong>${
        opts.dueDate ? ` on <strong>${longDate(opts.dueDate)}</strong>` : ""
      }.</p>
      ${opts.gcash ? `<p style="margin:4px 0">GCash: <strong>${escapeHtml(opts.gcash)}</strong></p>` : ""}
      ${opts.maya ? `<p style="margin:4px 0">Maya: <strong>${escapeHtml(opts.maya)}</strong></p>` : ""}
      <p>The PDF is attached. After paying, upload your proof in your tenant portal.</p>
      ${button(opts.viewUrl, "View invoice")}`
    : `
      <h2 style="margin:0 0 12px;color:#16a34a">Payment received ✓</h2>
      <p>Hi <strong>${escapeHtml(opts.tenantName)}</strong>,</p>
      <p>We received your payment of <strong>${peso(opts.total)}</strong>${period}. Thank you!</p>
      <p>Your receipt (${escapeHtml(opts.number)}) is attached as a PDF.</p>
      ${button(opts.viewUrl, "View receipt")}`;
  return sendEmail({
    to: opts.to,
    subject: isInvoice
      ? `Invoice ${opts.number} – ${peso(opts.total)}${opts.periodLabel ? ` (${opts.periodLabel})` : ""}`
      : `Receipt ${opts.number} – ${peso(opts.total)} received`,
    log: opts.log,
    attachments: [{ filename: `${opts.number}.pdf`, content: opts.pdf }],
    html: emailLayout(inner, `Sent on behalf of ${escapeHtml(opts.ownerName)} via TenantHub`),
  });
}

export async function sendContractForSignature(opts: {
  to: string;
  tenantName: string;
  ownerName: string;
  title: string;
  signUrl: string;
  log?: LogContext;
}): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: `Please sign: ${opts.title}`,
    log: opts.log,
    html: emailLayout(
      `
      <h2 style="margin:0 0 12px">Contract ready for your signature</h2>
      <p>Hi <strong>${escapeHtml(opts.tenantName)}</strong>,</p>
      <p><strong>${escapeHtml(opts.ownerName)}</strong> has signed <strong>${escapeHtml(opts.title)}</strong> and sent it to you.
         Please review the full contract and sign it online — it only takes a minute, no account needed.</p>
      ${button(opts.signUrl, "Review & sign")}
      <p style="color:#6b7280;font-size:13px">This link is private to you. Don't forward it.</p>`,
      `Sent on behalf of ${escapeHtml(opts.ownerName)} via TenantHub`
    ),
  });
}

export async function sendSignedContract(opts: {
  to: string;
  name: string;
  title: string;
  otherParty: string;
  pdf: Buffer;
  log?: LogContext;
}): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: `Signed copy: ${opts.title}`,
    log: opts.log,
    attachments: [{ filename: `${opts.title.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-") || "contract"}-signed.pdf`, content: opts.pdf }],
    html: emailLayout(`
      <h2 style="margin:0 0 12px;color:#16a34a">Contract fully signed ✓</h2>
      <p>Hi <strong>${escapeHtml(opts.name)}</strong>,</p>
      <p><strong>${escapeHtml(opts.title)}</strong> has been signed by both you and ${escapeHtml(opts.otherParty)}.
         Your signed copy, including the signature audit trail, is attached as a PDF. Keep it for your records.</p>`),
  });
}

// ─── Owner-facing (platform → landlord) ──────────────────────────────────────

export async function sendPasswordReset(
  to: string,
  name: string,
  newPassword: string
): Promise<boolean> {
  // Deliberately not logged: the body contains a credential.
  return sendEmail({
    to,
    subject: "Your TenantHub password has been reset",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Password Reset</h2>
        <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
        <p>We received a request to reset your password. Your new temporary password is:</p>
        <p style="font-size:18px;font-weight:bold;letter-spacing:1px">${escapeHtml(newPassword)}</p>
        <p>Please log in and change it as soon as possible.</p>
        <p style="color:#666;font-size:12px">If you didn't request this, please contact support immediately.</p>
      </div>
    `,
  });
}

export async function sendBillingReminder(
  to: string,
  ownerName: string,
  amount: number,
  dueDate: Date,
  period: string,
  log?: LogContext
): Promise<boolean> {
  const formatted = peso(amount);
  return sendEmail({
    to,
    subject: `Subscription payment due soon – ${formatted}`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Subscription Payment Reminder</h2>
        <p>Hi ${escapeHtml(ownerName)},</p>
        <p>Your TenantHub subscription for <strong>${escapeHtml(period)}</strong> (${formatted}) is due on
           <strong>${longDate(dueDate)}</strong>.</p>
        <p>Please pay and submit your reference number in the Billing section of your dashboard to avoid
           your account being paused.</p>
      </div>
    `,
  });
}

export async function sendBillingApproved(
  to: string,
  ownerName: string,
  period: string,
  loginUrl: string,
  log?: LogContext
): Promise<boolean> {
  // The login link is a one-time credential, so the logged preview omits it.
  const ok = await sendEmail({
    to,
    subject: `Payment confirmed – ${period}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16a34a">Payment Confirmed ✓</h2>
        <p>Hi ${escapeHtml(ownerName)},</p>
        <p>Your subscription payment for <strong>${escapeHtml(period)}</strong> has been confirmed. Thank you!</p>
        <p>Your account is active and ready to go.</p>
        <p><a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Log In Now</a></p>
        <p style="color:#666;font-size:12px">This link signs you in directly and expires in 48 hours.</p>
      </div>
    `,
  });
  if (log) {
    await logMessage({
      ...log,
      channel: "email",
      to,
      subject: `Payment confirmed – ${period}`,
      body: `Subscription payment for ${period} confirmed. Account active. (One-time login link included.)`,
      status: ok ? "sent" : "failed",
    });
  }
  return ok;
}

export async function sendBillingRejected(
  to: string,
  ownerName: string,
  period: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Payment could not be verified – ${period}`,
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#dc2626">Payment Could Not Be Verified</h2>
        <p>Hi ${escapeHtml(ownerName)},</p>
        <p>We couldn't verify your subscription payment for <strong>${escapeHtml(period)}</strong>.
           Please double-check your reference number and proof, then resubmit in the Billing
           section of your dashboard.</p>
      </div>
    `,
  });
}

export async function sendAccountPaused(
  to: string,
  ownerName: string,
  period: string,
  renewUrl?: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your TenantHub account has been paused",
    log,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#dc2626">Account Paused</h2>
        <p>Hi ${escapeHtml(ownerName)},</p>
        <p>Your subscription payment for <strong>${escapeHtml(period)}</strong> was not received by the due date,
           so your TenantHub account has been paused and you won't be able to log in until it's settled.</p>
        ${renewUrl ? `<p>Pay via GCash or Maya to restore access — your data is safe.</p>${button(renewUrl, "Renew my account")}` : "<p>Please contact support to arrange payment and restore access.</p>"}
      </div>
    `,
  });
}

export async function sendTrialEndingSoon(
  to: string,
  ownerName: string,
  trialEndsAt: Date,
  renewUrl?: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your TenantHub free trial ends tomorrow",
    log,
    html: emailLayout(`
      <h2 style="margin:0 0 12px">Your free trial ends tomorrow</h2>
      <p>Hi ${escapeHtml(ownerName)},</p>
      <p>Your 3-day TenantHub trial ends on <strong>${longDate(trialEndsAt)}</strong>.
         Keep your tenants, ledgers, contracts, and reminders running for just <strong>₱499/month</strong>.</p>
      ${renewUrl ? button(renewUrl, "Subscribe for ₱499/month") : ""}
      <p style="color:#6b7280;font-size:13px">Pay via GCash or Maya. You can also subscribe from Billing in your dashboard.</p>`),
  });
}

export async function sendTrialEnded(
  to: string,
  ownerName: string,
  renewUrl?: string,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "Your TenantHub free trial has ended",
    log,
    html: emailLayout(`
      <h2 style="margin:0 0 12px;color:#dc2626">Your free trial has ended</h2>
      <p>Hi ${escapeHtml(ownerName)},</p>
      <p>Your 3-day trial is over, so your account is paused. Don't worry — all your properties,
         tenants, and records are saved.</p>
      <p>Subscribe for <strong>₱499/month</strong> via GCash or Maya to pick up right where you left off.</p>
      ${renewUrl ? button(renewUrl, "Reactivate my account") : "<p>Contact support to reactivate.</p>"}`),
  });
}

export async function sendMonthlyReport(
  to: string,
  ownerName: string,
  monthLabel: string,
  totals: { collected: number; rent: number; electric: number; water: number; other: number },
  xlsxBuffer: Buffer,
  log?: LogContext
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `Your ${monthLabel} report is ready`,
    log,
    attachments: [
      {
        filename: `TenantHub-Report-${monthLabel.replace(/\s+/g, "-")}.xlsx`,
        content: xlsxBuffer,
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">${escapeHtml(monthLabel)} Report</h2>
        <p>Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
        <p>Here's your collected-payments summary for ${escapeHtml(monthLabel)}. The full breakdown, including every payment recorded this month, is attached as an Excel sheet.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666">Total Collected</td><td style="padding:6px 0;text-align:right;font-weight:bold">${peso(totals.collected)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Rent</td><td style="padding:6px 0;text-align:right">${peso(totals.rent)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Electric (Kuryente)</td><td style="padding:6px 0;text-align:right">${peso(totals.electric)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Water</td><td style="padding:6px 0;text-align:right">${peso(totals.water)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Other</td><td style="padding:6px 0;text-align:right">${peso(totals.other)}</td></tr>
        </table>
        <p style="color:#666;font-size:12px">— TenantHub</p>
      </div>
    `,
  });
}

// ─── Platform-admin-facing ───────────────────────────────────────────────────

export async function sendBillingSubmittedNotification(
  to: string,
  accountName: string,
  ownerName: string,
  amount: number,
  period: string,
  referenceNumber: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `New payment submitted – ${accountName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">New Subscription Payment Submitted</h2>
        <p><strong>${escapeHtml(accountName)}</strong> (${escapeHtml(ownerName)}) submitted a payment for <strong>${escapeHtml(period)}</strong>
           (${peso(amount)}).</p>
        <p>Reference number: <strong>${escapeHtml(referenceNumber)}</strong></p>
        <p>Review and approve it in the admin Billing page.</p>
        ${button(`${APP_URL}/admin/billing`, "Open admin billing")}
      </div>
    `,
  });
}

export async function sendHelpRequest(
  to: string,
  accountName: string,
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string
): Promise<boolean> {
  return sendEmail({
    to,
    replyTo: senderEmail,
    subject: `[Help] ${subject} – ${accountName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Help Request</h2>
        <p><strong>${escapeHtml(senderName)}</strong> (${escapeHtml(accountName)}, ${escapeHtml(senderEmail)}) submitted a help request:</p>
        <p><strong>${escapeHtml(subject)}</strong></p>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        <p style="color:#6b7280;font-size:13px">Reply directly to this email to respond to ${escapeHtml(senderName)}.</p>
      </div>
    `,
  });
}

export interface SignupDetails {
  accountId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  socialMedia: string | null;
  wantsOnboardingCall: boolean | null;
  trialEndsAt: Date | null;
}

function signupTable(d: SignupDetails): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 10px 6px 0;color:#6b7280;vertical-align:top">${k}</td><td style="padding:6px 0"><strong>${v}</strong></td></tr>`;
  const call =
    d.wantsOnboardingCall == null ? "—" : d.wantsOnboardingCall ? "✅ YES — call them" : "No";
  return `<table style="border-collapse:collapse;margin:12px 0">
    ${row("Name", escapeHtml(d.ownerName))}
    ${row("Business", escapeHtml(d.businessName))}
    ${row("Email", `<a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a>`)}
    ${row("Phone", d.phone ? `<a href="tel:${escapeHtml(d.phone)}">${escapeHtml(d.phone)}</a>` : "—")}
    ${row("Social media", d.socialMedia ? escapeHtml(d.socialMedia) : "—")}
    ${row("Onboarding call", call)}
    ${d.trialEndsAt ? row("Trial ends", longDate(d.trialEndsAt)) : ""}
  </table>`;
}

export async function sendNewSignupNotification(to: string, d: SignupDetails): Promise<boolean> {
  return sendEmail({
    to,
    subject: `🎉 New signup – ${d.ownerName}${d.wantsOnboardingCall ? " (wants a call)" : ""}`,
    log: { accountId: d.accountId, recipientType: "admin", recipientName: "Admin", category: "system" },
    html: emailLayout(`
      <h2 style="margin:0 0 8px">New TenantHub signup</h2>
      <p>A new landlord just started a 3-day free trial.</p>
      ${signupTable(d)}
      ${button(`${APP_URL}/admin/signups`, "Open Signups")}`),
  });
}

export async function sendAdminTrialAlert(
  to: string,
  d: SignupDetails,
  kind: "expiring" | "expired"
): Promise<boolean> {
  const expiring = kind === "expiring";
  return sendEmail({
    to,
    subject: expiring
      ? `⏳ Trial expires tomorrow – ${d.ownerName}`
      : `⛔ Trial expired – ${d.ownerName}`,
    log: { accountId: d.accountId, recipientType: "admin", recipientName: "Admin", category: "trial" },
    html: emailLayout(`
      <h2 style="margin:0 0 8px">${expiring ? "Trial expires tomorrow" : "Trial expired — account paused"}</h2>
      <p>${expiring ? "Good time for a follow-up call or message." : "They haven't subscribed yet. Consider a win-back message."}</p>
      ${signupTable(d)}
      ${button(`${APP_URL}/admin/signups`, "Open Signups")}`),
  });
}

/** Admin-triggered "notify me" step inside a CRM workflow. */
export async function sendAdminWorkflowNotice(to: string, subject: string, body: string, accountId: string): Promise<boolean> {
  return sendEmail({
    to,
    subject,
    log: { accountId, recipientType: "admin", recipientName: "Admin", category: "workflow" },
    html: emailLayout(`${textToHtml(body)}${button(`${APP_URL}/admin/signups`, "Open Signups")}`),
  });
}

/** Marketing email to a signup, sent by a CRM workflow step. Always carries an unsubscribe link. */
export async function sendWorkflowEmail(opts: {
  to: string;
  subject: string;
  body: string;
  unsubscribeUrl: string;
  log: LogContext;
}): Promise<boolean> {
  return sendEmail({
    to: opts.to,
    subject: opts.subject,
    log: opts.log,
    html: emailLayout(
      textToHtml(opts.body),
      `You're receiving this because you signed up for TenantHub. <a href="${opts.unsubscribeUrl}" style="color:#9ca3af">Unsubscribe</a>`
    ),
  });
}
