import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { workflowSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = workflowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const { triggerValue, ...rest } = parsed.data;
  const workflow = await prisma.workflow.create({
    data: { ...rest, triggerValue: rest.trigger === "lead_status" ? triggerValue : null, stopOnConversion: rest.stopOnConversion ?? true },
  });
  return NextResponse.json({ id: workflow.id }, { status: 201 });
}
