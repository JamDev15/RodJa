import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushSubscribeSchema, formatZodError } from "@/lib/validations";

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;
  if (!accountId || user.role !== "LANDLORD") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { accountId, p256dh: keys.p256dh, auth: keys.auth },
    create: { accountId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;
  if (!accountId || user.role !== "LANDLORD") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const endpoint = typeof (body as { endpoint?: unknown })?.endpoint === "string" ? (body as { endpoint: string }).endpoint : null;
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  // Scoped to this account so one landlord can't delete another's subscription.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, accountId } });
  return NextResponse.json({ success: true });
}
