import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/owner-auth";

/** Copies a workflow (paused) so it can be edited into a variation. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const w = await prisma.ownerWorkflow.findFirst({ where: { id, accountId } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.ownerWorkflow.create({
    data: {
      accountId,
      name: `${w.name} (copy)`.slice(0, 120),
      description: w.description,
      isActive: false,
      trigger: w.trigger,
      offsetDays: w.offsetDays,
      steps: w.steps as object,
      stopWhenPaid: w.stopWhenPaid,
    },
  });
  return NextResponse.json({ id: copy.id }, { status: 201 });
}
