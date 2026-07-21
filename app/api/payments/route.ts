import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentCreateSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { tenantId, amount, month, dueDate, status, method, notes } = parsed.data;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, unit: { property: { accountId } } },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      amount,
      month,
      dueDate,
      paidDate: status === "approved" ? new Date() : null,
      status: status ?? "pending",
      method: method || null,
      notes: notes || null,
    },
  });
  return NextResponse.json(payment, { status: 201 });
}
