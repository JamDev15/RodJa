import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { connectUrl, unlink } from "@/lib/messenger";

/** Office user: open Messenger to connect alerts (7-day signed link). */
export async function GET(req: Request) {
  const actor = await currentActor();
  if (actor?.kind !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = await connectUrl({ kind: "ADMIN", accountId: actor.accountId, userId: actor.id }, actor.accountId);
  if (!url) return NextResponse.redirect(new URL("/dashboard/settings/integrations", req.url), 303);
  return NextResponse.redirect(url, 303);
}

export async function DELETE() {
  const actor = await currentActor();
  if (actor?.kind !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ disconnected: await unlink({ kind: "ADMIN", accountId: actor.accountId, userId: actor.id }) });
}
