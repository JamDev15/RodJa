import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { workflowSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const toggle = z.object({ isActive: z.boolean() }).strict().safeParse(body);
  if (toggle.success) {
    await prisma.workflow.update({ where: { id }, data: { isActive: toggle.data.isActive } });
    return NextResponse.json({ success: true });
  }

  const parsed = workflowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { triggerValue, ...rest } = parsed.data;

  // People mid-sequence keep their position; if steps were removed, anyone
  // past the new end simply finishes on their next run.
  await prisma.workflow.update({
    where: { id },
    data: { ...rest, triggerValue: rest.trigger === "lead_status" ? triggerValue : null },
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;
  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
