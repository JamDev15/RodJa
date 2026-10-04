import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/owner-auth";
import { ownerWorkflowSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = ownerWorkflowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  if ((await prisma.ownerWorkflow.count({ where: { accountId } })) >= 30) {
    return NextResponse.json({ error: "You can have up to 30 workflows" }, { status: 400 });
  }
  const w = await prisma.ownerWorkflow.create({
    data: { ...parsed.data, accountId, offsetDays: parsed.data.offsetDays ?? 0, stopWhenPaid: parsed.data.stopWhenPaid ?? true },
  });
  return NextResponse.json({ id: w.id }, { status: 201 });
}
