import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";
import { propertyCreateSchema, formatZodError } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const properties = await prisma.property.findMany({
    where: { accountId },
    include: { units: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(properties);
}

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = propertyCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { name, address, type, description } = parsed.data;

  const property = await prisma.property.create({
    data: {
      accountId,
      name,
      address,
      type,
      description: description || null,
      slug: generateSlug(`${name}-${Date.now()}`),
    },
  });
  return NextResponse.json(property, { status: 201 });
}
