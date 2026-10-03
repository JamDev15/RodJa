import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { workflowEnrollSchema, formatZodError } from "@/lib/validations";
import { enroll } from "@/lib/workflows";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = workflowEnrollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  if (!workflow.isActive) return NextResponse.json({ error: "Turn this workflow on before enrolling people" }, { status: 400 });

  let enrolled = 0;
  let skipped = 0;
  for (const accountId of parsed.data.accountIds) {
    const res = await enroll(id, accountId);
    if (res) enrolled++;
    else skipped++;
  }
  return NextResponse.json({ enrolled, skipped });
}
