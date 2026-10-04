import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, isRateLimited, recordFailedAttempt } from "@/lib/rate-limit";
import { signContractSchema, formatZodError } from "@/lib/validations";
import { contractInclude, deliverSignedCopies } from "@/lib/contracts";

/**
 * Tenant e-signature. Public (no login): the unguessable token in the link
 * is the credential, the same model as the emailed magic-login links.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = getClientIp(req);
  const identifier = `sign:${ip}`;
  if (await isRateLimited(identifier)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const contract = await prisma.contract.findUnique({ where: { signToken: token } });
  if (!contract) {
    await recordFailedAttempt(identifier);
    return NextResponse.json({ error: "This signing link is not valid." }, { status: 404 });
  }
  if (contract.status === "signed") return NextResponse.json({ error: "Already signed." }, { status: 409 });
  if (contract.status !== "sent") return NextResponse.json({ error: "This contract is no longer open for signing." }, { status: 410 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = signContractSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  // Conditional update guards against a double-submit racing itself.
  const { count } = await prisma.contract.updateMany({
    where: { id: contract.id, status: "sent" },
    data: {
      status: "signed",
      tenantSignature: parsed.data.signature,
      tenantSignedName: parsed.data.signedName,
      tenantSignedAt: new Date(),
      tenantSignedIp: ip,
      tenantUserAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  if (count === 0) return NextResponse.json({ error: "Already signed." }, { status: 409 });

  const signed = await prisma.contract.findUniqueOrThrow({ where: { id: contract.id }, include: contractInclude });
  await deliverSignedCopies(signed);
  return NextResponse.json({ status: "signed" });
}
