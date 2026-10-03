import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/owner-auth";

/** Stops a workflow for one tenant. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.ownerWorkflowEnrollment.updateMany({
    where: { id, status: "active", workflow: { accountId } },
    data: { status: "exited", exitReason: "Stopped by you", completedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
