import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminAccountUpdateSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = adminAccountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.account.update({
    where: { id },
    data: {
      isActive: parsed.data.isActive,
      lifetimeAccess: parsed.data.lifetimeAccess,
      // Granting lifetime access also clears the trial clock — it no
      // longer means anything once the account is exempt from it.
      trialEndsAt: parsed.data.lifetimeAccess ? null : undefined,
    },
  });
  return NextResponse.json(updated);
}
