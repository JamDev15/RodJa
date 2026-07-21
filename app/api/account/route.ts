import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountUpdateSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { name, ownerName, phone, gcashNumber, mayaNumber, bankDetails } = parsed.data;

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      name: name || undefined,
      ownerName: ownerName || undefined,
      phone: phone || null,
      gcashNumber: gcashNumber || null,
      mayaNumber: mayaNumber || null,
      bankDetails: bankDetails || null,
    },
  });
  return NextResponse.json(updated);
}
