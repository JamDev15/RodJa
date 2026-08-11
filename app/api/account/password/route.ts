import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { accountPasswordChangeSchema, formatZodError } from "@/lib/validations";

export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Staff share the dashboard but log in with their own User record — this
  // endpoint only changes the landlord's own Account password.
  if (user.role !== "LANDLORD") {
    return NextResponse.json({ error: "Only the account owner can change this password" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = accountPasswordChangeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const account = await prisma.account.findUnique({ where: { id: user.accountId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, account.password);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.account.update({ where: { id: account.id }, data: { password: hashed } });

  return NextResponse.json({ success: true });
}
