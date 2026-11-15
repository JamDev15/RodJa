// Daily scheduled work for collections billing (called from /api/cron/daily).
// Every step is idempotent, so a rerun or an overlapping run is harmless.

import { prisma } from "@/lib/prisma";
import { systemActor } from "./actor";
import { cyclesDueForGeneration, toDbDate, todayIn } from "./calendar";
import { sendStatementEmail, sendVecoReminder } from "./notify";
import { scheduleOf } from "./profile";
import { generateStatements, publishPeriod } from "./statements";
import { missingVecoReceipts } from "./veco";

export async function runCollectionsSweep(now: Date = new Date()) {
  const profiles = await prisma.billingProfile.findMany({ where: { enabled: true }, include: { property: { select: { name: true } } } });
  const summary = { profiles: profiles.length, generated: 0, published: 0, sent: 0, vecoReminders: 0, errors: [] as string[] };

  for (const profile of profiles) {
    const actor = systemActor(profile.accountId);
    const today = todayIn(profile.timezone, now);
    try {
      if (profile.autoGenerate) {
        for (const cycle of cyclesDueForGeneration(scheduleOf(profile), today)) {
          const { results } = await generateStatements(actor, profile.propertyId, cycle.periodKey, { now });
          summary.generated += results.filter((r) => r.outcome === "created").length;
          if (!profile.requireReview) summary.published += (await publishPeriod(actor, profile.propertyId, cycle.periodKey)).filter((r) => !r.alreadyPublished).length;
        }
      }

      const due = await prisma.statement.findMany({
        where: { propertyId: profile.propertyId, status: "PUBLISHED", sentAt: null, distributeOn: { lte: toDbDate(today) }, tenant: { email: { not: null } }, OR: [{ sendError: null }, { sendError: { startsWith: "Email failed" } }] },
        select: { id: true },
        take: 200,
      });
      for (const st of due) if ((await sendStatementEmail(st.id)).sent) summary.sent++;

      if (profile.vecoEnabled) {
        for (const m of await missingVecoReceipts(profile.propertyId, today)) {
          if (await sendVecoReminder(m, profile.accountId, profile.property.name)) summary.vecoReminders++;
        }
      }
    } catch (err) {
      console.error(`Collections sweep failed for property ${profile.propertyId}:`, err);
      summary.errors.push(`${profile.propertyId}: ${String(err)}`);
    }
  }
  return summary;
}
