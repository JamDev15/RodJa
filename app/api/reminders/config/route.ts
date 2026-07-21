import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reminderConfigSchema, formatZodError } from "@/lib/validations";

export async function PUT(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = reminderConfigSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { smsEnabled, emailEnabled, inAppEnabled } = parsed.data;

  const config = await prisma.reminderConfig.upsert({
    where: { accountId },
    update: { smsEnabled, emailEnabled, inAppEnabled },
    create: { accountId, smsEnabled, emailEnabled, inAppEnabled },
  });
  return NextResponse.json(config);
}
