// Encrypts secrets kept in the database (e.g. Facebook Page access tokens)
// with AES-256-GCM. Key: TOKEN_ENCRYPTION_KEY (any long random string), or,
// if unset, one derived from AUTH_SECRET. Changing the key makes stored
// tokens unreadable, so landlords would need to reconnect their Page.

import crypto from "crypto";

function key(): Buffer {
  const base = process.env.TOKEN_ENCRYPTION_KEY || `${process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ""}:token-box`;
  if (base.length < 16) throw new Error("TOKEN_ENCRYPTION_KEY (or AUTH_SECRET) is not set");
  return crypto.createHash("sha256").update(base).digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Unreadable secret");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}
