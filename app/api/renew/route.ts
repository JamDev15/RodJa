import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignedToken } from "@/lib/tokens";
import { renewSchema, formatZodError } from "@/lib/validations";
import { uploadBillingProof, validateProofFile } from "@/lib/storage";
import { sendBillingSubmittedNotification } from "@/lib/email";
import { getNotificationRecipients, periodLabelFor } from "@/lib/billing";
import { getSubscriptionPlan } from "@/lib/plans";
import { getClientIp, isRateLimited, recordFailedAttempt } from "@/lib/rate-limit";

/**
 * Reactivation payment from the /renew page (no login needed — the signed
 * token from the trial-ended/paused email, or from a password check, proves
 * who it is). Marks the open bill as submitted for admin review; approving
 * it in Admin → Billing reactivates the account and emails a login link.
 */
export async function POST(req: Request) {
  const identifier = `renew:${getClientIp(req)}`;
  if (await isRateLimited(identifier)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const form = await req.formData();
  const parsed = renewSchema.safeParse({
    token: (form.get("token") as string) || "",
    referenceNumber: (form.get("referenceNumber") as string) || "",
  });
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const accountId = verifySignedToken("renew", parsed.data.token);
  if (!accountId) {
    await recordFailedAttempt(identifier);
    return NextResponse.json({ error: "This link has expired. Sign in on the renew page to get a fresh one." }, { status: 401 });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { plan: true } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const file = form.get("proof") as File | null;
  if (file && file.size > 0) {
    const err = validateProofFile(file);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const plan = await getSubscriptionPlan();
  const now = new Date();
  const open = await prisma.billingRecord.findFirst({
    where: { accountId, status: { in: ["pending", "overdue", "rejected", "submitted"] } },
    orderBy: { dueDate: "desc" },
  });
  const period = open?.period ?? periodLabelFor(now);
  const proofUrl = file && file.size > 0 ? await uploadBillingProof(file, accountId, period) : null;
  // Accounts not yet on the paid plan (legacy Free) switch to it on approval.
  const targetPlanId = account.plan.price > 0 ? open?.targetPlanId ?? null : plan.id;

  const record = open
    ? await prisma.billingRecord.update({
        where: { id: open.id },
        data: { status: "submitted", referenceNumber: parsed.data.referenceNumber, proofUrl: proofUrl ?? open.proofUrl, targetPlanId, amount: account.plan.price > 0 ? open.amount : plan.price },
      })
    : await prisma.billingRecord.create({
        data: { accountId, amount: plan.price, period, dueDate: now, status: "submitted", referenceNumber: parsed.data.referenceNumber, proofUrl, targetPlanId },
      });

  const recipients = await getNotificationRecipients();
  await Promise.all(
    recipients.map((to) =>
      sendBillingSubmittedNotification(to, account.name, account.ownerName, record.amount, record.period, parsed.data.referenceNumber)
    )
  );
  return NextResponse.json({ status: "submitted" });
}
