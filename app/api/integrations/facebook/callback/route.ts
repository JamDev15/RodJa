import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { handleCallback } from "@/lib/messenger/facebook";

/** Facebook redirects here after login; then the landlord picks a Page. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const id = await handleCallback(await currentActor(), { code: q.get("code"), state: q.get("state"), error: q.get("error") });
    return NextResponse.redirect(new URL(`/dashboard/settings/integrations?connect=${id}`, req.url), 303);
  } catch (err) {
    if (!(err instanceof BillingError)) console.error("Facebook callback failed:", err);
    const msg = err instanceof BillingError ? err.message : "Facebook connection failed. Please try again.";
    return NextResponse.redirect(new URL(`/dashboard/settings/integrations?error=${encodeURIComponent(msg)}`, req.url), 303);
  }
}
