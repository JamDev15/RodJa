import crypto from "crypto";

/**
 * Stateless signed links (renew-subscription, unsubscribe). The payload is
 * readable but tamper-proof: an HMAC over it with the app's auth secret.
 */
type Purpose = "renew" | "unsubscribe";

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSignedToken(purpose: Purpose, accountId: string, ttlDays: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload = Buffer.from(JSON.stringify({ p: purpose, a: accountId, e: exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the accountId if the token is authentic, unexpired, and for this purpose. */
export function verifySignedToken(purpose: Purpose, token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p: string; a: string; e: number };
    if (data.p !== purpose || typeof data.a !== "string") return null;
    if (data.e < Date.now() / 1000) return null;
    return data.a;
  } catch {
    return null;
  }
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.tenant-hub.app").replace(/\/$/, "");

export function renewUrlFor(accountId: string): string {
  return `${APP_URL}/renew?token=${createSignedToken("renew", accountId, 30)}`;
}

export function unsubscribeUrlFor(accountId: string): string {
  return `${APP_URL}/api/unsubscribe?token=${createSignedToken("unsubscribe", accountId, 3650)}`;
}
