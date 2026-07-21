import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentMonth } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: { include: { property: { include: { account: true } } } },
      payments: { where: { month: getCurrentMonth() }, take: 1 },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    rentAmount: tenant.unit.rentAmount,
    currentPayment: tenant.payments[0] ?? null,
    account: {
      gcashNumber: tenant.unit.property.account.gcashNumber,
      mayaNumber: tenant.unit.property.account.mayaNumber,
      bankDetails: tenant.unit.property.account.bankDetails,
    },
  });
}
