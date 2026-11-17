import { NextResponse } from "next/server";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { startConnect } from "@/lib/messenger/facebook";

/** Settings → Integrations → Connect Facebook Page: go to Facebook's login dialog. */
export async function GET(req: Request) {
  try {
    return NextResponse.redirect(startConnect(await currentActor()), 303);
  } catch (err) {
    const msg = err instanceof BillingError ? err.message : "Could not start the Facebook connection";
    return NextResponse.redirect(new URL(`/dashboard/settings/integrations?error=${encodeURIComponent(msg)}`, req.url), 303);
  }
}
