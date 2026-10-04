import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { automationSchema, formatZodError } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const automations = await prisma.automation.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(automations);
}

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const count = await prisma.automation.count({ where: { accountId } });
  if (count >= 50) return NextResponse.json({ error: "You can have up to 50 automations" }, { status: 400 });

  const automation = await prisma.automation.create({
    data: { accountId, ...parsed.data, onlyUnpaid: parsed.data.onlyUnpaid ?? true },
  });
  return NextResponse.json(automation, { status: 201 });
}
