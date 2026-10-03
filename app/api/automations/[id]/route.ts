import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { automationSchema, automationToggleSchema, formatZodError } from "@/lib/validations";

async function load(id: string) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string | undefined;
  if (!accountId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const automation = await prisma.automation.findFirst({ where: { id, accountId } });
  if (!automation) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { automation };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { automation, error } = await load(id);
  if (error) return error;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  // Either a bare on/off toggle, or a full edit.
  const toggle = automationToggleSchema.strict().safeParse(body);
  if (toggle.success) {
    const updated = await prisma.automation.update({ where: { id: automation.id }, data: { isActive: toggle.data.isActive } });
    return NextResponse.json(updated);
  }

  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const updated = await prisma.automation.update({ where: { id: automation.id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { automation, error } = await load(id);
  if (error) return error;
  await prisma.automation.delete({ where: { id: automation.id } });
  return NextResponse.json({ success: true });
}
