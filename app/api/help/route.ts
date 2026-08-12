import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordFailedAttempt } from "@/lib/rate-limit";
import { helpRequestSchema, formatZodError } from "@/lib/validations";
import { sendHelpRequest } from "@/lib/email";
import { getNotificationRecipients } from "@/lib/billing";

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const identifier = `help:${accountId}`;
  if (await isRateLimited(identifier)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = helpRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordFailedAttempt(identifier);

  const senderName = user.role === "STAFF" ? user.name ?? account.ownerName : account.ownerName;
  const senderEmail = user.role === "STAFF" ? user.email ?? account.email : account.email;

  const recipients = await getNotificationRecipients();
  const results = await Promise.all(
    recipients.map((email) => sendHelpRequest(email, account.name, senderName, senderEmail, parsed.data.subject, parsed.data.message))
  );

  if (!results.some(Boolean)) {
    return NextResponse.json({ error: "Couldn't send your message. Please try again later." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
