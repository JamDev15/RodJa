import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { leadUpdateSchema, formatZodError } from "@/lib/validations";
import { exitWorkflowsOnConversion, triggerWorkflows } from "@/lib/workflows";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const before = await prisma.account.findUnique({ where: { id }, select: { leadStatus: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...(parsed.data.leadStatus ? { leadStatus: parsed.data.leadStatus } : {}),
      ...(parsed.data.leadNotes !== undefined ? { leadNotes: parsed.data.leadNotes || null } : {}),
    },
    select: { id: true, leadStatus: true, leadNotes: true },
  });

  const statusChanged = parsed.data.leadStatus && parsed.data.leadStatus !== before.leadStatus;
  let enrolledIn = 0;
  if (statusChanged) {
    if (updated.leadStatus === "converted") await exitWorkflowsOnConversion(id);
    const activeBefore = await prisma.workflowEnrollment.count({ where: { accountId: id, status: "active" } });
    await triggerWorkflows(id, "lead_status", updated.leadStatus);
    const activeAfter = await prisma.workflowEnrollment.count({ where: { accountId: id, status: "active" } });
    enrolledIn = Math.max(0, activeAfter - activeBefore);
  }
  return NextResponse.json({ ...updated, enrolledIn });
}
