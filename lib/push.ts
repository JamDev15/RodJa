import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublic && vapidPrivate && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a push notification to every device a landlord account has
 * subscribed. A 404/410 response means the browser revoked or expired that
 * subscription (normal, expected over time) — deleted rather than treated
 * as a failure.
 */
export async function sendPushToAccount(accountId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { accountId } });
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Push send failed:", err);
        }
        failed++;
      }
    })
  );

  return { sent, failed };
}
