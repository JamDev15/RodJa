import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@tenanthub.com";

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
