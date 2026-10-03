import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSmsConfigured } from "@/lib/sms";
import { AutomationsManager, type AutomationRow } from "./automations-manager";

export default async function AutomationsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const automations = await prisma.automation.findMany({
    where: { accountId },
    include: { _count: { select: { runs: { where: { status: "sent" } } } } },
    orderBy: { createdAt: "asc" },
  });

  const rows: AutomationRow[] = automations.map((a) => ({
    id: a.id,
    name: a.name,
    isActive: a.isActive,
    trigger: a.trigger,
    offsetDays: a.offsetDays,
    audience: a.audience,
    channels: Array.isArray(a.channels) ? (a.channels as string[]) : [],
    subject: a.subject,
    message: a.message,
    onlyUnpaid: a.onlyUnpaid,
    lastRunAt: a.lastRunAt?.toISOString() ?? null,
    sentCount: a._count.runs,
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Automations</h1>
        <p className="text-gray-400 text-sm mt-1">
          Build your own reminder rules for tenants and yourself — by email, SMS, tenant portal, or push.
          Everything sent is recorded in{" "}
          <Link href="/dashboard/messages" className="text-blue-400 hover:text-blue-300">Message History</Link>.
        </p>
      </div>
      <AutomationsManager automations={rows} smsConfigured={isSmsConfigured()} />
    </div>
  );
}
