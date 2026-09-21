import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReminderConfig } from "./reminder-config";
import { PushSubscribeToggle } from "@/components/dashboard/push-subscribe-toggle";

export default async function RemindersPage() {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;

  const config = await prisma.reminderConfig.findUnique({ where: { accountId } });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Reminders</h1>
        <p className="text-gray-400 text-sm mt-1">Configure automatic payment reminders for your tenants</p>
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-gray-300">
        Separately, every unpaid rent, electric, water, or other bill on a tenant&apos;s ledger automatically
        gets an email reminder — to you and the tenant — 2 days before, 1 day before, and on its due date.
        It stops on its own once that bill is marked paid. No setup needed for this part.
      </div>

      <ReminderConfig config={config} accountId={accountId} />
      {user?.role === "LANDLORD" && <PushSubscribeToggle />}
    </div>
  );
}
