import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ledgerUpdateSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.monthlyLedger.findFirst({ where: { id, tenant: { unit: { property: { accountId } } } } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = ledgerUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const updated = await prisma.monthlyLedger.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.monthlyLedger.findFirst({ where: { id, tenant: { unit: { property: { accountId } } } } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.monthlyLedger.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
