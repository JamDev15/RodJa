import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maintenanceCreateSchema, formatZodError } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.maintenanceRequest.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = maintenanceCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { title, description, priority } = parsed.data;

  const request = await prisma.maintenanceRequest.create({
    data: { tenantId, title, description, priority: priority ?? "normal" },
  });
  return NextResponse.json(request, { status: 201 });
}
