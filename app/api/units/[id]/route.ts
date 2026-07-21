import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unitUpdateSchema, formatZodError } from "@/lib/validations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unit = await prisma.unit.findFirst({ where: { id, property: { accountId } } });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(unit);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unit = await prisma.unit.findFirst({ where: { id, property: { accountId } } });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = unitUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { unitNumber, floor, rentAmount, depositAmount, description } = parsed.data;

  const updated = await prisma.unit.update({
    where: { id },
    data: {
      unitNumber,
      floor: floor || null,
      rentAmount,
      depositAmount: depositAmount ?? null,
      description: description || null,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unit = await prisma.unit.findFirst({
    where: { id, property: { accountId } },
    include: { tenants: { where: { isActive: true } } },
  });
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (unit.tenants.length > 0) return NextResponse.json({ error: "Unit has active tenant" }, { status: 400 });

  await prisma.unit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
