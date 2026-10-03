import { prisma } from "@/lib/prisma";

export type AccessState = "ok" | "trial_ended" | "paused";

/**
 * Whether a landlord account may use the dashboard right now. Checked on
 * every dashboard render so an expired trial locks out immediately (not just
 * when the daily cron next runs) and existing sessions can't outlive a pause.
 * A payment awaiting admin review keeps access open in the meantime.
 */
export async function getAccessState(accountId: string, now: Date = new Date()): Promise<AccessState> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { isActive: true, lifetimeAccess: true, trialEndsAt: true },
  });
  if (!account) return "paused";
  if (account.lifetimeAccess) return "ok";

  const submitted = await prisma.billingRecord.findFirst({ where: { accountId, status: "submitted" }, select: { id: true } });
  if (!account.isActive) return submitted ? "ok" : "paused";

  if (account.trialEndsAt && account.trialEndsAt <= now && !submitted) {
    const paid = await prisma.billingRecord.findFirst({ where: { accountId, status: "paid" }, select: { id: true } });
    if (!paid) return "trial_ended";
  }
  return "ok";
}
