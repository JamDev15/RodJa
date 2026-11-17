import { NextResponse } from "next/server";
import { handleWebhook, metaApp, validSignature, verifyChallenge } from "@/lib/messenger";

/**
 * Meta webhook for every connected Facebook Page (TenantHub's Meta app). Public route (see proxy.ts): it
 * authenticates every POST by the X-Hub-Signature-256 HMAC with the app
 * secret, and the GET subscription check by META_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const challenge = verifyChallenge(new URL(req.url).searchParams);
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: Request) {
  if (!metaApp()) return new NextResponse("Not configured", { status: 404 });
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Bad signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  try {
    await handleWebhook(payload);
  } catch (err) {
    // Acknowledge anyway: Meta retries failures and eventually disables the webhook.
    console.error("Messenger webhook failed:", err);
  }
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
