import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;
  const w = await prisma.workflow.findUnique({ where: { id } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const copy = await prisma.workflow.create({
    data: {
      name: `${w.name} (copy)`.slice(0, 120),
      description: w.description,
      isActive: false,
      trigger: w.trigger,
      triggerValue: w.triggerValue,
      steps: w.steps as object,
      stopOnConversion: w.stopOnConversion,
    },
  });
  return NextResponse.json({ id: copy.id }, { status: 201 });
}
