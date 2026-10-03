import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatZodError } from "@/lib/validations";

const schema = z
  .object({ autoSendReceipts: z.boolean().optional(), emailOwnerCopies: z.boolean().optional() })
  .refine((d) => d.autoSendReceipts !== undefined || d.emailOwnerCopies !== undefined, { message: "Nothing to update" });

export async function PATCH(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  await prisma.account.update({ where: { id: accountId }, data: parsed.data });
  return NextResponse.json(parsed.data);
}
