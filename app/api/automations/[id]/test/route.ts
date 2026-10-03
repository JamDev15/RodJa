import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendAutomationTest } from "@/lib/automations";

/** Emails the owner a sample of this automation, filled with example data. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const automation = await prisma.automation.findFirst({ where: { id, accountId }, include: { account: true } });
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ok = await sendAutomationTest(automation, automation.account);
  if (!ok) return NextResponse.json({ error: "Couldn't send the test email" }, { status: 502 });
  return NextResponse.json({ sentTo: automation.account.email });
}
