import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentMonth } from "@/lib/utils";
import { validateProofFile } from "@/lib/storage";
import { dueDateForMonth } from "@/lib/due-dates";

const ALLOWED_METHODS = ["gcash", "maya", "bank", "cash"];

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const method = formData.get("method") as string;
  const notes = (formData.get("notes") as string) || "";
  const file = formData.get("proof") as File | null;

  if (!method || !ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (notes.length > 2000) {
    return NextResponse.json({ error: "Notes too long" }, { status: 400 });
  }

  let proofUrl: string | null = null;
  if (file && file.size > 0) {
    const validationError = validateProofFile(file);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    // Upload to Supabase storage
    const { uploadPaymentProof } = await import("@/lib/storage");
    proofUrl = await uploadPaymentProof(file, tenantId, getCurrentMonth());
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { unit: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const month = getCurrentMonth();
  const dueDate = dueDateForMonth(month, tenant.dueDay);

  // Upsert payment for this month
  const existing = await prisma.payment.findFirst({ where: { tenantId, month } });
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { status: "submitted", proofUrl, method, notes: notes || null },
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
        notes: notes || null,
      },
    });
  }

  return NextResponse.json({ success: true });
}
