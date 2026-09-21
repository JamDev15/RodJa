import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@tenanthub.com";

/** Escapes free-form user text before it's interpolated into an email's HTML body. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPaymentReminder(
  to: string,
  tenantName: string,
  amount: number,
  dueDate: Date,
  landlordName: string,
  gcash?: string | null,
  maya?: string | null
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Rent Reminder – ${formatted} due`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Rent Payment Reminder</h2>
          <p>Hi <strong>${tenantName}</strong>,</p>
          <p>This is a reminder that your rent of <strong>${formatted}</strong>
             is due on <strong>${new Intl.DateTimeFormat("en-PH",{dateStyle:"long"}).format(dueDate)}</strong>.</p>
          ${gcash ? `<p>GCash: <strong>${gcash}</strong></p>` : ""}
          ${maya ? `<p>Maya: <strong>${maya}</strong></p>` : ""}
          <p>Please upload your payment proof in your tenant portal after paying.</p>
          <p style="color:#666;font-size:12px">— ${landlordName}</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendPaymentApproved(
  to: string,
  tenantName: string,
  amount: number,
  month: string
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Payment Approved – ${month}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#16a34a">Payment Approved ✓</h2>
          <p>Hi <strong>${tenantName}</strong>,</p>
          <p>Your payment of <strong>${formatted}</strong> for <strong>${month}</strong> has been approved.</p>
          <p>Thank you!</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendPasswordReset(
  to: string,
  name: string,
  newPassword: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Your TenantHub password has been reset",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Password Reset</h2>
          <p>Hi <strong>${name}</strong>,</p>
          <p>We received a request to reset your password. Your new temporary password is:</p>
          <p style="font-size:18px;font-weight:bold;letter-spacing:1px">${newPassword}</p>
          <p>Please log in and change it as soon as possible.</p>
          <p style="color:#666;font-size:12px">If you didn't request this, please contact support immediately.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendBillingReminder(
  to: string,
  ownerName: string,
  amount: number,
  dueDate: Date,
  period: string
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Subscription payment due soon – ${formatted}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Subscription Payment Reminder</h2>
          <p>Hi ${ownerName},</p>
          <p>Your TenantHub subscription for <strong>${period}</strong> (${formatted}) is due on
             <strong>${new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(dueDate)}</strong>.</p>
          <p>Please pay and submit your reference number in the Billing section of your dashboard to avoid
             your account being paused.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendBillingApproved(
  to: string,
  ownerName: string,
  period: string,
  loginUrl: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Payment confirmed – ${period}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#16a34a">Payment Confirmed ✓</h2>
          <p>Hi ${ownerName},</p>
          <p>Your subscription payment for <strong>${period}</strong> has been confirmed. Thank you!</p>
          <p>Your account is active and ready to go.</p>
          <p><a href="${loginUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Log In Now</a></p>
          <p style="color:#666;font-size:12px">This link signs you in directly and expires in 48 hours.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendBillingSubmittedNotification(
  to: string,
  accountName: string,
  ownerName: string,
  amount: number,
  period: string,
  referenceNumber: string
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `New payment submitted – ${accountName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">New Subscription Payment Submitted</h2>
          <p><strong>${accountName}</strong> (${ownerName}) submitted a payment for <strong>${period}</strong>
             (${formatted}).</p>
          <p>Reference number: <strong>${referenceNumber}</strong></p>
          <p>Review and approve it in the admin Billing page.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendHelpRequest(
  to: string,
  accountName: string,
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: senderEmail,
      subject: `[Help] ${subject} – ${accountName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Help Request</h2>
          <p><strong>${escapeHtml(senderName)}</strong> (${escapeHtml(accountName)}, ${escapeHtml(senderEmail)}) submitted a help request:</p>
          <p><strong>${escapeHtml(subject)}</strong></p>
          <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
          <p style="color:#6b7280;font-size:13px">Reply directly to this email to respond to ${senderName}.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendNewSignupNotification(
  to: string,
  accountName: string,
  ownerName: string,
  accountEmail: string,
  planName: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `New landlord signed up – ${accountName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">New Signup</h2>
          <p><strong>${accountName}</strong> (${ownerName}) just signed up on the <strong>${planName}</strong> plan.</p>
          <p>Account email: ${accountEmail}</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendTrialEndingSoon(
  to: string,
  ownerName: string,
  trialEndsAt: Date
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Your free trial ends in 3 days",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Your Free Trial Is Ending Soon</h2>
          <p>Hi ${ownerName},</p>
          <p>Your TenantHub free trial ends on
             <strong>${new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(trialEndsAt)}</strong>.</p>
          <p>Upgrade to Basic or Pro in the Billing section of your dashboard to keep using TenantHub without interruption.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendTrialEnded(
  to: string,
  ownerName: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Your TenantHub free trial has ended",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#dc2626">Free Trial Ended</h2>
          <p>Hi ${ownerName},</p>
          <p>Your free trial has ended, so your TenantHub account has been paused.
             Upgrade to Basic or Pro to restore access — contact support to arrange payment
             and get a login link once you're on a paid plan.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendBillingRejected(
  to: string,
  ownerName: string,
  period: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Payment could not be verified – ${period}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#dc2626">Payment Could Not Be Verified</h2>
          <p>Hi ${ownerName},</p>
          <p>We couldn't verify your subscription payment for <strong>${period}</strong>.
             Please double-check your reference number and proof, then resubmit in the Billing
             section of your dashboard.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendAccountPaused(
  to: string,
  ownerName: string,
  period: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Your TenantHub account has been paused",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#dc2626">Account Paused</h2>
          <p>Hi ${ownerName},</p>
          <p>Your subscription payment for <strong>${period}</strong> was not received by the due date,
             so your TenantHub account has been paused and you won't be able to log in until it's settled.</p>
          <p>Please contact support to arrange payment and restore access.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendWelcomeTenant(
  to: string,
  tenantName: string,
  phone: string,
  pin: string,
  portalUrl: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Welcome to your Tenant Portal",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Welcome, ${tenantName}!</h2>
          <p>Your tenant portal is ready. Log in with:</p>
          <ul>
            <li>Phone: <strong>${phone}</strong></li>
            <li>PIN: <strong>${pin}</strong></li>
          </ul>
          <p><a href="${portalUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Open Portal</a></p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
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
  trigger: string
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(amount);
  const phrase = billTriggerPhrase(trigger);
  const label = escapeHtml(billLabel);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `${billLabel} for ${tenantName} is ${phrase} – ${formatted}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">Bill Reminder</h2>
          <p>Hi ${escapeHtml(ownerName)},</p>
          <p><strong>${escapeHtml(tenantName)}</strong>'s <strong>${label}</strong> of
             <strong>${formatted}</strong> is ${phrase}
             (<strong>${new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(dueDate)}</strong>).</p>
          <p>This reminder will stop once it's marked paid in the tenant's ledger.</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendTenantBillReminder(
  to: string,
  tenantName: string,
  billLabel: string,
  amount: number,
  dueDate: Date,
  trigger: string,
  landlordName: string
): Promise<boolean> {
  const formatted = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(amount);
  const phrase = billTriggerPhrase(trigger);
  const label = escapeHtml(billLabel);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `${billLabel} ${phrase} – ${formatted}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#1a1a2e">${label} Reminder</h2>
          <p>Hi <strong>${escapeHtml(tenantName)}</strong>,</p>
          <p>Your <strong>${label}</strong> of <strong>${formatted}</strong> is ${phrase}
             (<strong>${new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(dueDate)}</strong>).</p>
          <p style="color:#666;font-size:12px">— ${escapeHtml(landlordName)}</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export async function sendMonthlyReport(
  to: string,
  ownerName: string,
  monthLabel: string,
  totals: { collected: number; rent: number; electric: number; water: number; other: number },
  xlsxBuffer: Buffer
): Promise<boolean> {
  const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(n);

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `Your ${monthLabel} report is ready`,
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
            <tr><td style="padding:6px 0;color:#666">Total Collected</td><td style="padding:6px 0;text-align:right;font-weight:bold">${money(totals.collected)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Rent</td><td style="padding:6px 0;text-align:right">${money(totals.rent)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Electric (Kuryente)</td><td style="padding:6px 0;text-align:right">${money(totals.electric)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Water</td><td style="padding:6px 0;text-align:right">${money(totals.water)}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Other</td><td style="padding:6px 0;text-align:right">${money(totals.other)}</td></tr>
          </table>
          <p style="color:#666;font-size:12px">— TenantHub</p>
        </div>
      `,
    });
    if (error) {
      console.error("Resend rejected email:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}
