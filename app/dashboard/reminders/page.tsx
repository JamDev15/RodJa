import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReminderConfig } from "./reminder-config";
import { PushSubscribeToggle } from "@/components/dashboard/push-subscribe-toggle";
import { AutoReceiptToggle } from "@/components/dashboard/auto-receipt-toggle";
import Link from "next/link";

export default async function RemindersPage() {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;

  const [config, account] = await Promise.all([
    prisma.reminderConfig.findUnique({ where: { accountId } }),
    prisma.account.findUnique({ where: { id: accountId }, select: { autoSendReceipts: true, emailOwnerCopies: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Reminders</h1>
        <p className="text-th-muted text-sm mt-1">Configure automatic payment reminders for your tenants</p>
      </div>

      <div className="rounded-xl border border-th-accent/30 bg-th-brand-soft p-4 text-sm text-th-ink/80">
        Separately, every unpaid rent, electric, water, or other bill on a tenant&apos;s ledger automatically
        gets an email reminder — to you and the tenant — 2 days before, 1 day before, and on its due date.
        It stops on its own once that bill is marked paid. No setup needed for this part.
      </div>

      <div className="rounded-xl border border-th-line bg-th-surface p-4 text-sm text-th-ink/80">
        Need a custom schedule, owner alerts, or lease-ending notices?{" "}
        <Link href="/dashboard/automations" className="text-th-accent hover:text-th-accent">Build an automation →</Link>
      </div>

      <ReminderConfig config={config} accountId={accountId} />
      <AutoReceiptToggle initial={account?.autoSendReceipts ?? true} initialOwnerCopies={account?.emailOwnerCopies ?? true} />
      {user?.role === "LANDLORD" && <PushSubscribeToggle />}
    </div>
  );
}
