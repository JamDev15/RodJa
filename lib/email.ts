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
    await resend.emails.send({
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
    return true;
  } catch {
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
    await resend.emails.send({
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
    return true;
  } catch {
    return false;
  }
}

export async function sendPasswordReset(
  to: string,
  name: string,
  newPassword: string
): Promise<boolean> {
  try {
    await resend.emails.send({
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
    return true;
  } catch {
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
    await resend.emails.send({
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
    return true;
  } catch {
    return false;
  }
}

export async function sendBillingApproved(
  to: string,
  ownerName: string,
  period: string
): Promise<boolean> {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Payment confirmed – ${period}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#16a34a">Payment Confirmed ✓</h2>
          <p>Hi ${ownerName},</p>
          <p>Your subscription payment for <strong>${period}</strong> has been confirmed. Thank you!</p>
        </div>
      `,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendBillingRejected(
  to: string,
  ownerName: string,
  period: string
): Promise<boolean> {
  try {
    await resend.emails.send({
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
    return true;
  } catch {
    return false;
  }
}

export async function sendAccountPaused(
  to: string,
  ownerName: string,
  period: string
): Promise<boolean> {
  try {
    await resend.emails.send({
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
    return true;
  } catch {
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
    await resend.emails.send({
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
    return true;
  } catch {
    return false;
  }
}
