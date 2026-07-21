import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const property = await prisma.property.findFirst({ where: { id, accountId } });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.property.update({
    where: { id },
    data: { listingStatus: "pending" },
  });
  return NextResponse.redirect(new URL("/dashboard/listings", _req.url));
}
