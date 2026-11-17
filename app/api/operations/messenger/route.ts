import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { connectUrl, unlink } from "@/lib/messenger";

/** Office user: open Messenger to connect alerts (7-day signed link). */
export async function GET() {
  const actor = await currentActor();
  if (actor?.kind !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = connectUrl({ kind: "ADMIN", accountId: actor.accountId, userId: actor.id });
  if (!url) return NextResponse.json({ error: "Messenger alerts aren't set up yet" }, { status: 404 });
  return NextResponse.redirect(url, 303);
}

export async function DELETE() {
  const actor = await currentActor();
  if (actor?.kind !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ disconnected: await unlink({ kind: "ADMIN", accountId: actor.accountId, userId: actor.id }) });
}
