import { NextResponse } from "next/server";
import { deleteFacebookUserData, parseSignedRequest } from "@/lib/messenger/facebook";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");

/**
 * Meta's Data Deletion Request callback (and Deauthorize callback): a
 * signed_request from Meta for a Facebook user who removed TenantHub. Public
 * route; authenticated by the HMAC in signed_request (app secret).
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const data = typeof signed === "string" ? parseSignedRequest(signed) : null;
  if (!data?.user_id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { confirmationCode } = await deleteFacebookUserData(String(data.user_id));
  return NextResponse.json({ url: `${APP_URL}/data-deletion?code=${confirmationCode}`, confirmation_code: confirmationCode });
}
