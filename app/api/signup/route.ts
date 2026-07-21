import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isRateLimited, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import { signupSchema, formatZodError } from "@/lib/validations";

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

    const json = await req.json();
    const parsed = signupSchema.safeParse(json);
    if (!parsed.success) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }
    const { name, ownerName, email, password, phone, plan: planKey } = parsed.data;

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

    const hashed = await bcrypt.hash(password, 12);
    const account = await prisma.account.create({
      data: {
        name,
        ownerName,
        email,
        password: hashed,
        phone: phone || null,
        planId: dbPlan.id,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ id: account.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
