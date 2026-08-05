import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { tenantUpdateSchema, formatZodError } from "@/lib/validations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findFirst({
    where: { id, unit: { property: { accountId } } },
    include: { unit: { include: { property: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Never send the PIN hash to the client — it's a one-way hash and has no
  // legitimate use in the browser; exposing it also invites offline
  // brute-forcing of what's usually a short numeric PIN.
  const { portalPin: _portalPin, ...tenantWithoutPin } = tenant;
  return NextResponse.json(tenantWithoutPin);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findFirst({ where: { id, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = tenantUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { name, email, phone, moveInDate, moveOutDate, dueDay, depositAmount, depositPaid, portalPin, emergencyContact, notes, isActive } = parsed.data;

  // Check phone uniqueness if changed
  if (phone && phone !== tenant.phone) {
    const existing = await prisma.tenant.findUnique({ where: { phone } });
    if (existing) return NextResponse.json({ error: "Phone number already registered" }, { status: 400 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      name,
      email: email || null,
      phone,
      moveInDate: moveInDate ? new Date(moveInDate) : undefined,
      moveOutDate: moveOutDate ? new Date(moveOutDate) : null,
      dueDay: dueDay ?? undefined,
      depositAmount: depositAmount != null ? Number(depositAmount) : undefined,
      depositPaid: depositPaid ?? undefined,
      portalPin: portalPin ? await bcrypt.hash(portalPin, 10) : undefined,
      emergencyContact: emergencyContact || null,
      notes: notes || null,
      isActive: isActive ?? undefined,
    },
  });
  return NextResponse.json(updated);
}
