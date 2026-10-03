import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSignedToken } from "@/lib/tokens";
import { getClientIp, isRateLimited, recordFailedAttempt, clearAttempts } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});

/** Password check for owners who reach /renew without the emailed link. */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });

  const identifier = `renew-login:${parsed.data.email}:${getClientIp(req)}`;
  if (await isRateLimited(identifier)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const account = await prisma.account.findUnique({ where: { email: parsed.data.email } });
  if (!account || !(await bcrypt.compare(parsed.data.password, account.password))) {
    await recordFailedAttempt(identifier);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await clearAttempts(identifier);
  return NextResponse.json({ token: createSignedToken("renew", account.id, 1) });
}
