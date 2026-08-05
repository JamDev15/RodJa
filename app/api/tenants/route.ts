import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { tenantCreateSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const parsed = tenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
  }
  const { unitId, name, email, phone, moveInDate, dueDay, depositAmount, portalPin, emergencyContact, notes } = parsed.data;

  // Verify unit belongs to this account
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { accountId } } });
  if (!unit) return NextResponse.json({ message: "Unit not found" }, { status: 404 });

  // Check phone uniqueness
  const existing = await prisma.tenant.findUnique({ where: { phone } });
  if (existing) return NextResponse.json({ message: "Phone number already registered" }, { status: 400 });

  const hashedPin = await bcrypt.hash(portalPin, 10);
  const tenant = await prisma.tenant.create({
    data: {
      unitId,
      name,
      email: email || null,
      phone,
      moveInDate,
      dueDay: dueDay ?? undefined,
      depositAmount: depositAmount ?? null,
      portalPin: hashedPin,
      emergencyContact: emergencyContact || null,
      notes: notes || null,
    },
  });

  // Mark unit as occupied
  await prisma.unit.update({ where: { id: unitId }, data: { status: "occupied" } });

  return NextResponse.json(tenant, { status: 201 });
}
