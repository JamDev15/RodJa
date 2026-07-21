import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPaymentProof, validateProofFile } from "@/lib/storage";
import { getCurrentMonth } from "@/lib/utils";

const ALLOWED_METHODS = ["gcash", "maya", "bank", "cash"];

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const method = formData.get("method") as string;
  const file = formData.get("file") as File | null;

  if (!method || !ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (file && file.size > 0) {
    const validationError = validateProofFile(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { unit: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const month = getCurrentMonth();
  let proofUrl: string | null = null;
  if (file && file.size > 0) {
    proofUrl = await uploadPaymentProof(file, tenantId, month);
  }

  const dueDate = new Date(new Date().getFullYear(), new Date().getMonth(), 5);
  const existing = await prisma.payment.findFirst({ where: { tenantId, month } });

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { status: "submitted", proofUrl, method },
    });
  } else {
    await prisma.payment.create({
      data: {
        tenantId,
        amount: tenant.unit.rentAmount,
        month,
        dueDate,
        status: "submitted",
        proofUrl,
        method,
      },
    });
  }

  return NextResponse.json({ success: true });
}
