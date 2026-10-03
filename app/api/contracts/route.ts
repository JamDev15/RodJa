import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractCreateSchema, formatZodError } from "@/lib/validations";
import { newSignToken } from "@/lib/contracts";

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = contractCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({ where: { id: parsed.data.tenantId, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const contract = await prisma.contract.create({
    data: { ...parsed.data, accountId, status: "draft", signToken: newSignToken() },
  });
  return NextResponse.json({ id: contract.id }, { status: 201 });
}
