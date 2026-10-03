import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

/** Removes one person from a workflow (stops all remaining steps). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;
  await prisma.workflowEnrollment.updateMany({
    where: { id, status: "active" },
    data: { status: "exited", exitReason: "Removed by admin", completedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
