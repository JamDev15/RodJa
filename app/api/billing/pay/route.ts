import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBillingProof, validateProofFile } from "@/lib/storage";
import { billingPaySchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const referenceNumber = (formData.get("referenceNumber") as string) || "";
  const file = formData.get("proof") as File | null;

  const parsed = billingPaySchema.safeParse({ referenceNumber });
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  let proofUrl: string | null = null;
  const record = await prisma.billingRecord.findFirst({
    where: { accountId, status: { in: ["pending", "submitted"] } },
    orderBy: { dueDate: "desc" },
  });
  if (!record) return NextResponse.json({ error: "No payment currently due" }, { status: 404 });

  if (file && file.size > 0) {
    const validationError = validateProofFile(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    proofUrl = await uploadBillingProof(file, accountId, record.period);
  }

  const updated = await prisma.billingRecord.update({
    where: { id: record.id },
    data: {
      status: "submitted",
      referenceNumber: parsed.data.referenceNumber,
      proofUrl: proofUrl ?? record.proofUrl,
    },
  });

  return NextResponse.json(updated);
}
