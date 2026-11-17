// Push notifications to the iOS and Android apps through Firebase Cloud
// Messaging (HTTP v1). iOS delivery goes through FCM with an APNs key
// uploaded in the Firebase console. Off until FIREBASE_SERVICE_ACCOUNT is
// set (the service-account JSON, raw or base64).
//
// Device tokens are registered by the app after sign-in (/api/devices) and
// removed on sign-out or when FCM reports them invalid.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logMessage } from "@/lib/message-log";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(text) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: FetchLike = (url, init) => fetch(url, init);
export function setPushFetchForTests(f: FetchLike | null) {
  fetcher = f ?? ((url, init) => fetch(url, init));
  cached = null;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new Error(`FCM auth failed (${res.status})`);
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export interface NativeAlert {
  title: string;
  body: string;
  /** Path the app opens when the notification is tapped. */
  path: string;
  dedupeKey?: string;
}

async function sendTo(devices: { id: string; token: string; accountId: string; tenantId: string | null; kind: string }[], alert: NativeAlert): Promise<number> {
  const sa = serviceAccount();
  if (!sa || !devices.length) return 0;
  let sent = 0;
  let bearer: string;
  try {
    bearer = await accessToken(sa);
  } catch (err) {
    console.error(err);
    return 0;
  }
  for (const d of devices) {
    const subject = alert.dedupeKey ? `${alert.dedupeKey}:${d.id}` : undefined;
    if (subject && (await prisma.messageLog.count({ where: { channel: "push", subject, status: "sent" } }))) continue;
    try {
      const res = await fetcher(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: d.token,
            notification: { title: alert.title.slice(0, 100), body: alert.body.slice(0, 300) },
            data: { path: alert.path },
            android: { priority: "HIGH", notification: { channel_id: "alerts" } },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (res.ok) {
        sent++;
        await logMessage({ accountId: d.accountId, tenantId: d.tenantId, recipientType: d.kind === "TENANT" ? "tenant" : "owner", channel: "push", subject, body: alert.body, category: "system", status: "sent" });
      } else {
        const text = await res.text().catch(() => "");
        // Uninstalled app / expired token: forget it.
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT.*registration/i.test(text)) await prisma.deviceToken.deleteMany({ where: { id: d.id } });
        await logMessage({ accountId: d.accountId, tenantId: d.tenantId, recipientType: d.kind === "TENANT" ? "tenant" : "owner", channel: "push", subject, body: alert.body, category: "system", status: "failed", error: `${res.status} ${text.slice(0, 200)}` });
      }
    } catch (err) {
      console.error("FCM send failed:", err);
    }
  }
  return sent;
}

export async function pushTenant(tenantId: string, alert: NativeAlert): Promise<number> {
  if (!serviceAccount()) return 0;
  const devices = await prisma.deviceToken.findMany({ where: { tenantId, kind: "TENANT" } });
  return sendTo(devices, alert);
}

export async function pushOffice(accountId: string, alert: NativeAlert): Promise<number> {
  if (!serviceAccount()) return 0;
  const devices = await prisma.deviceToken.findMany({ where: { accountId, kind: "ADMIN" } });
  return sendTo(devices, alert);
}

/** Register (or move) a device token for the signed-in person. */
export async function registerDevice(input: { token: string; platform: string; accountId: string; kind: "TENANT" | "ADMIN"; tenantId?: string | null; userId?: string | null }) {
  if (!/^[\w:\-.]{20,4096}$/.test(input.token)) throw new Error("Invalid device token");
  if (input.platform !== "ios" && input.platform !== "android") throw new Error("Invalid platform");
  const data = { platform: input.platform, accountId: input.accountId, kind: input.kind, tenantId: input.tenantId ?? null, userId: input.userId ?? null, lastSeenAt: new Date() };
  return prisma.deviceToken.upsert({ where: { token: input.token }, create: { ...data, token: input.token }, update: data });
}
