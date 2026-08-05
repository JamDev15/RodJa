import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBillingApproved, sendBillingRejected } from "@/lib/email";
import { adminBillingReviewSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = adminBillingReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const record = await prisma.billingRecord.findUnique({ where: { id }, include: { account: true } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.action === "approve") {
    const updated = await prisma.billingRecord.update({
      where: { id },
      data: { status: "paid", paidAt: new Date() },
    });
    // Approving always restores access — covers both a normal on-time
    // approval and an overdue/paused account that has since paid.
    // If this record was an upgrade request, switch the account onto the
    // new plan too.
    await prisma.account.update({
      where: { id: record.accountId },
      data: { isActive: true, planId: record.targetPlanId ?? undefined },
    });

    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.loginToken.create({
      data: {
        accountId: record.accountId,
        token,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/magic-login?token=${token}`;
    await sendBillingApproved(record.account.email, record.account.ownerName, record.period, loginUrl);
    return NextResponse.json(updated);
  }

  const updated = await prisma.billingRecord.update({
    where: { id },
    data: { status: "pending", referenceNumber: null, proofUrl: null },
  });
  await sendBillingRejected(record.account.email, record.account.ownerName, record.period);
  return NextResponse.json(updated);
}
