import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rate-limit";
import { signContractSchema, formatZodError } from "@/lib/validations";
import { contractHash, contractInclude, deliverForSignature } from "@/lib/contracts";

/** Owner signs the draft, which freezes the text, then it's sent to the tenant. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contract = await prisma.contract.findFirst({ where: { id, accountId } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status !== "draft") return NextResponse.json({ error: "Already sent" }, { status: 409 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = signContractSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const now = new Date();
  const updated = await prisma.contract.update({
    where: { id },
    data: {
      status: "sent",
      documentHash: contractHash(contract.title, contract.body),
      ownerSignature: parsed.data.signature,
      ownerSignedName: parsed.data.signedName,
      ownerSignedAt: now,
      ownerSignedIp: getClientIp(req),
      sentAt: now,
    },
    include: contractInclude,
  });

  const { emailed } = await deliverForSignature(updated);
  return NextResponse.json({ status: "sent", emailed, hasEmail: !!updated.tenant.email });
}
