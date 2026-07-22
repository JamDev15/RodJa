import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";
import { isRateLimited, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import { forgotPasswordSchema, formatZodError } from "@/lib/validations";

const GENERIC_MESSAGE = "If that email is registered, a new password has been sent to it.";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const identifier = `forgot-password:${ip}`;

  if (await isRateLimited(identifier)) {
    return NextResponse.json({ message: "Too many attempts. Please try again later." }, { status: 429 });
  }
  await recordFailedAttempt(identifier);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
  }
  const { email } = parsed.data;

  const newPassword = crypto.randomBytes(9).toString("base64url");
  const hashed = await bcrypt.hash(newPassword, 12);

  const account = await prisma.account.findUnique({ where: { email } });
  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password: hashed } });
    await sendPasswordReset(email, account.ownerName, newPassword);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    await sendPasswordReset(email, user.name, newPassword);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  // No account found — still return the generic message so this endpoint
  // can't be used to enumerate registered emails.
  return NextResponse.json({ message: GENERIC_MESSAGE });
}
