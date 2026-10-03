import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/owner-auth";
import { ownerWorkflowSchema, formatZodError } from "@/lib/validations";

async function owned(id: string) {
  const accountId = await currentAccountId();
  if (!accountId) return null;
  return prisma.ownerWorkflow.findFirst({ where: { id, accountId } });
}

/** Full edit (any time — people mid-sequence keep their place) or a bare on/off toggle. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await owned(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const toggle = z.object({ isActive: z.boolean() }).strict().safeParse(body);
  if (toggle.success) {
    await prisma.ownerWorkflow.update({ where: { id }, data: { isActive: toggle.data.isActive } });
    return NextResponse.json({ success: true });
  }

  const parsed = ownerWorkflowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  await prisma.ownerWorkflow.update({ where: { id }, data: { ...parsed.data, offsetDays: parsed.data.offsetDays ?? 0 } });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await owned(id);
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.ownerWorkflow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
