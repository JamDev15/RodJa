import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { periodLabelFor } from "@/lib/billing";
import { billingUpgradeSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = billingUpgradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const [account, targetPlan] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId } }),
    prisma.plan.findUnique({ where: { id: parsed.data.planId } }),
  ]);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!targetPlan || !targetPlan.isActive) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (targetPlan.id === account.planId) {
    return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
  }

  const now = new Date();
  const existing = await prisma.billingRecord.findFirst({
    where: { accountId, status: { in: ["pending", "submitted"] } },
    orderBy: { dueDate: "desc" },
  });

  const data = {
    amount: targetPlan.price,
    period: periodLabelFor(now),
    dueDate: now,
    status: "pending",
    referenceNumber: null,
    proofUrl: null,
    targetPlanId: targetPlan.id,
  };

  const record = existing
    ? await prisma.billingRecord.update({ where: { id: existing.id }, data })
    : await prisma.billingRecord.create({ data: { accountId, ...data } });

  return NextResponse.json(record);
}
