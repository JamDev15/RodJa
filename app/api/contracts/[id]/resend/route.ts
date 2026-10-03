import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractInclude, deliverForSignature } from "@/lib/contracts";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contract = await prisma.contract.findFirst({ where: { id, accountId }, include: contractInclude });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status !== "sent") return NextResponse.json({ error: "Only contracts awaiting signature can be resent" }, { status: 409 });
  if (!contract.tenant.email) return NextResponse.json({ error: "This tenant has no email. Copy the signing link and send it by SMS or Messenger instead." }, { status: 400 });

  const { emailed } = await deliverForSignature(contract);
  if (!emailed) return NextResponse.json({ error: "Email could not be sent" }, { status: 502 });
  return NextResponse.json({ emailed });
}
