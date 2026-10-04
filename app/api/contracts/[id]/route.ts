import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractUpdateSchema, formatZodError } from "@/lib/validations";

async function owned(id: string) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string | undefined;
  if (!accountId) return null;
  return prisma.contract.findFirst({ where: { id, accountId } });
}

/** Drafts are freely editable; once signed by the owner the text is frozen. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await owned(id);
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status !== "draft") {
    return NextResponse.json({ error: "This contract was already sent and can't be edited. Void it and create a new one instead." }, { status: 409 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = contractUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  await prisma.contract.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true });
}

/** Deletes a draft, or voids a sent contract (kept for the record, link stops working). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await owned(id);
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.status === "draft") {
    await prisma.contract.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  }
  if (contract.status === "signed") {
    return NextResponse.json({ error: "A fully signed contract can't be voided here." }, { status: 409 });
  }
  await prisma.contract.update({ where: { id }, data: { status: "void" } });
  return NextResponse.json({ voided: true });
}
