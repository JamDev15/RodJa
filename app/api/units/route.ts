import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { unitCreateSchema, formatZodError } from "@/lib/validations";

const duplicateSchema = z.object({
  duplicateFrom: z.string().min(1),
  unitNumber: z.string().trim().max(50).optional(),
});

export async function GET() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const units = await prisma.unit.findMany({
    where: { property: { accountId }, status: "vacant" },
    include: { property: { select: { name: true } } },
    orderBy: { unitNumber: "asc" },
  });
  return NextResponse.json(units);
}

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  // Duplicate flow: copy an existing unit
  if (body != null && typeof body === "object" && "duplicateFrom" in body) {
    const parsed = duplicateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const { duplicateFrom, unitNumber } = parsed.data;

    const source = await prisma.unit.findFirst({ where: { id: duplicateFrom, property: { accountId } } });
    if (!source) return NextResponse.json({ error: "Source unit not found" }, { status: 404 });
    const copy = await prisma.unit.create({
      data: {
        propertyId: source.propertyId,
        unitNumber: unitNumber || `${source.unitNumber}-copy`,
        floor: source.floor,
        rentAmount: source.rentAmount,
        depositAmount: source.depositAmount,
        description: source.description,
        status: "vacant",
      },
    });
    return NextResponse.json(copy, { status: 201 });
  }

  const parsed = unitCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { propertyId, unitNumber, floor, rentAmount, depositAmount, description } = parsed.data;

  // Verify property belongs to this account
  const property = await prisma.property.findFirst({ where: { id: propertyId, accountId } });
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const unit = await prisma.unit.create({
    data: {
      propertyId,
      unitNumber,
      floor: floor || null,
      rentAmount,
      depositAmount: depositAmount ?? null,
      description: description || null,
      status: "vacant",
    },
  });
  return NextResponse.json(unit, { status: 201 });
}
