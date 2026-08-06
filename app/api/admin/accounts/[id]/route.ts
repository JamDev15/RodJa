import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminAccountUpdateSchema, adminAccountDeleteSchema, formatZodError } from "@/lib/validations";

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

  const parsed = adminAccountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.account.update({
    where: { id },
    data: {
      isActive: parsed.data.isActive,
      lifetimeAccess: parsed.data.lifetimeAccess,
      // Granting lifetime access also clears the trial clock — it no
      // longer means anything once the account is exempt from it.
      trialEndsAt: parsed.data.lifetimeAccess ? null : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = adminAccountDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Server-side confirmation too, not just the UI dialog — the caller must
  // supply the exact account name to prove this isn't a misclick/mistake.
  if (parsed.data.confirmName !== account.name) {
    return NextResponse.json({ error: "Confirmation name does not match" }, { status: 400 });
  }

  // Hard delete, cascading through every account-scoped record. Order
  // matters — children before parents — since none of these relations are
  // configured with onDelete: Cascade at the schema level (deliberately;
  // that'd make cascades possible from any deletion path, not just this
  // one deliberate admin action). MonthlyLedger is the one exception: it
  // *is* schema-level cascade-on-Tenant, so it's cleaned up automatically
  // when the Tenant rows below are deleted.
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { tenant: { unit: { property: { accountId: id } } } } }),
    prisma.maintenanceRequest.deleteMany({ where: { tenant: { unit: { property: { accountId: id } } } } }),
    prisma.reminder.deleteMany({ where: { tenant: { unit: { property: { accountId: id } } } } }),
    prisma.notice.deleteMany({ where: { accountId: id } }),
    prisma.tenant.deleteMany({ where: { unit: { property: { accountId: id } } } }),
    prisma.unit.deleteMany({ where: { property: { accountId: id } } }),
    prisma.property.deleteMany({ where: { accountId: id } }),
    prisma.billingRecord.deleteMany({ where: { accountId: id } }),
    prisma.user.deleteMany({ where: { accountId: id } }),
    prisma.reminderConfig.deleteMany({ where: { accountId: id } }),
    prisma.loginToken.deleteMany({ where: { accountId: id } }),
    prisma.account.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true });
}
