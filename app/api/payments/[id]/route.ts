import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatZodError } from "@/lib/validations";

const paymentActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectedReason: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = paymentActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { action, rejectedReason } = parsed.data;

  const payment = await prisma.payment.findFirst({
    where: { id, tenant: { unit: { property: { accountId } } } },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.payment.update({
    where: { id },
    data: {
      status: action === "approve" ? "approved" : "pending",
      paidDate: action === "approve" ? new Date() : null,
      rejectedReason: action === "reject" ? rejectedReason : null,
    },
  });
  return NextResponse.json(updated);
}
