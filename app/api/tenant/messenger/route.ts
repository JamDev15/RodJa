import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { prisma } from "@/lib/prisma";
import { connectUrl, unlink } from "@/lib/messenger";
import { tenantFeaturesEnabled } from "@/lib/operations/messages";

async function tenantOrNull() {
  const actor = await currentActor();
  if (actor?.kind !== "TENANT") return null;
  const t = await prisma.tenant.findFirst({ where: { id: actor.tenantId, isActive: true, unit: { property: { accountId: actor.accountId } } }, select: { id: true, unit: { select: { propertyId: true } } } });
  if (!t || !(await tenantFeaturesEnabled(t.unit.propertyId))) return null;
  return t;
}

/** Opens Messenger with a signed, 7-day connect link for this tenancy. */
export async function GET() {
  const t = await tenantOrNull();
  if (!t) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const url = connectUrl({ kind: "TENANT", tenantId: t.id });
  if (!url) return NextResponse.json({ error: "Messenger alerts aren't set up yet" }, { status: 404 });
  return NextResponse.redirect(url, 303);
}

/** Turn Messenger alerts off. */
export async function DELETE() {
  const t = await tenantOrNull();
  if (!t) return NextResponse.json({ error: "Not available" }, { status: 404 });
  return NextResponse.json({ disconnected: await unlink({ kind: "TENANT", tenantId: t.id }) });
}
