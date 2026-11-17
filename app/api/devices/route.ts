import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { prisma } from "@/lib/prisma";
import { registerDevice } from "@/lib/native-push";

/** The phone app registers its push token after sign-in (tenants and office users). */
export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor || (actor.kind !== "TENANT" && actor.kind !== "ADMIN")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { token?: string; platform?: string };
  try {
    await registerDevice({ token: String(body.token ?? ""), platform: String(body.platform ?? ""), accountId: actor.accountId, kind: actor.kind, tenantId: actor.kind === "TENANT" ? actor.tenantId : null, userId: actor.kind === "ADMIN" ? actor.id : null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid" }, { status: 400 });
  }
}

/** Sign-out: stop pushes to this device. */
export async function DELETE(req: Request) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (body.token) await prisma.deviceToken.deleteMany({ where: { token: String(body.token), accountId: actor.accountId } });
  return NextResponse.json({ ok: true });
}
