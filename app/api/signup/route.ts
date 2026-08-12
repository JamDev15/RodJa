import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isRateLimited, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import { signupSchema, formatZodError } from "@/lib/validations";
import { uploadBillingProof, validateProofFile } from "@/lib/storage";
import { sendBillingSubmittedNotification, sendNewSignupNotification } from "@/lib/email";
import { periodLabelFor, getNotificationRecipients } from "@/lib/billing";

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const identifier = `signup:${ip}`;
    if (await isRateLimited(identifier)) {
      return NextResponse.json({ message: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const formData = await req.formData();
    const fields = {
      name: (formData.get("name") as string) || "",
      ownerName: (formData.get("ownerName") as string) || "",
      email: (formData.get("email") as string) || "",
      password: (formData.get("password") as string) || "",
      phone: (formData.get("phone") as string) || "",
      plan: (formData.get("plan") as string) || "free",
      referenceNumber: (formData.get("referenceNumber") as string) || "",
    };
    const file = formData.get("proof") as File | null;

    const parsed = signupSchema.safeParse(fields);
    if (!parsed.success) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }
    const { name, ownerName, email, password, phone, plan: planKey, referenceNumber } = parsed.data;
    const isPaidPlan = planKey === "basic" || planKey === "pro";

    const existing = await prisma.account.findUnique({ where: { email } });
    if (existing) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ message: "Email already registered" }, { status: 400 });
    }

    const planName = PLAN_NAMES[planKey ?? "free"] ?? "Free";
    let dbPlan = await prisma.plan.findFirst({ where: { name: planName } });

    if (!dbPlan) {
      // Seed plans on first signup
      await prisma.plan.createMany({
        data: [
          { name: "Free", price: 0, maxUnits: 3, maxTenants: 20, maxProperties: 1, features: { smsReminders: false, paymentProof: false, publicListings: false, maintenance: false } },
          { name: "Basic", price: 199, maxUnits: 15, maxTenants: 50, maxProperties: 3, features: { smsReminders: true, paymentProof: true, publicListings: false, maintenance: false } },
          { name: "Pro", price: 499, maxUnits: -1, maxTenants: -1, maxProperties: -1, features: { smsReminders: true, paymentProof: true, publicListings: true, maintenance: true } },
          { name: "Enterprise", price: 0, maxUnits: -1, maxTenants: -1, maxProperties: -1, features: { smsReminders: true, paymentProof: true, publicListings: true, maintenance: true, apiAccess: true, whiteLabelBranding: true } },
        ],
        skipDuplicates: true,
      });
      dbPlan = await prisma.plan.findFirst({ where: { name: planName } });
    }

    if (!dbPlan) {
      return NextResponse.json({ message: "Plan not found" }, { status: 500 });
    }

    let proofUrl: string | null = null;
    if (isPaidPlan && file && file.size > 0) {
      const validationError = validateProofFile(file);
      if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const account = await prisma.account.create({
      data: {
        name,
        ownerName,
        email,
        password: hashed,
        phone: phone || null,
        planId: dbPlan.id,
        // Paid plans have no trial and stay inactive until the admin
        // approves the payment submitted below; Free is instant with a
        // 1-day trial.
        trialEndsAt: isPaidPlan ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: !isPaidPlan,
      },
    });

    const notificationRecipients = await getNotificationRecipients();
    await Promise.all(
      notificationRecipients.map((email) =>
        sendNewSignupNotification(email, account.name, account.ownerName, account.email, planName)
      )
    );

    if (isPaidPlan) {
      if (file && file.size > 0) {
        proofUrl = await uploadBillingProof(file, account.id, periodLabelFor(new Date()));
      }
      const record = await prisma.billingRecord.create({
        data: {
          accountId: account.id,
          amount: dbPlan.price,
          period: periodLabelFor(new Date()),
          dueDate: new Date(),
          status: "submitted",
          referenceNumber,
          proofUrl,
        },
      });
      await Promise.all(
        notificationRecipients.map((email) =>
          sendBillingSubmittedNotification(email, account.name, account.ownerName, record.amount, record.period, referenceNumber ?? "")
        )
      );
    }

    return NextResponse.json({ id: account.id, pendingApproval: isPaidPlan }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
