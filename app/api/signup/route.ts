import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isRateLimited, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validations";
import { sendNewSignupNotification } from "@/lib/email";
import { getNotificationRecipients, periodLabelFor, signupDetailsOf } from "@/lib/billing";
import { getSubscriptionPlan, TRIAL_DAYS } from "@/lib/plans";
import { triggerWorkflows } from "@/lib/workflows";

/**
 * Every signup gets a 3-day free trial of the ₱499/month plan. The first bill
 * is created right away, due when the trial ends, so the owner can subscribe
 * from Billing at any time during the trial.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const identifier = `signup:${ip}`;
    if (await isRateLimited(identifier)) {
      return NextResponse.json({ message: "Too many attempts. Please try again later." }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
    }
    const { ownerName, name, email, password, phone, socialMedia, wantsOnboardingCall } = parsed.data;

    const existing = await prisma.account.findUnique({ where: { email } });
    if (existing) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ message: "That email is already registered. Try signing in instead." }, { status: 400 });
    }

    const plan = await getSubscriptionPlan();
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const hashed = await bcrypt.hash(password, 12);

    const account = await prisma.account.create({
      data: {
        name: name?.trim() || `${ownerName.split(/\s+/)[0]}'s Rentals`,
        ownerName,
        email,
        password: hashed,
        phone,
        socialMedia,
        wantsOnboardingCall: wantsOnboardingCall === "yes",
        planId: plan.id,
        trialEndsAt,
        isActive: true,
        leadStatus: "new",
      },
    });

    await prisma.billingRecord.create({
      data: {
        accountId: account.id,
        amount: plan.price,
        period: periodLabelFor(trialEndsAt),
        dueDate: trialEndsAt,
        status: "pending",
      },
    });

    const recipients = await getNotificationRecipients();
    await Promise.all(recipients.map((to) => sendNewSignupNotification(to, signupDetailsOf(account))));
    await triggerWorkflows(account.id, "signup");

    return NextResponse.json({ id: account.id, trialEndsAt }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
