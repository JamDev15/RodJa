import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReminderConfig } from "./reminder-config";

export default async function RemindersPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const config = await prisma.reminderConfig.findUnique({ where: { accountId } });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Reminders</h1>
        <p className="text-gray-400 text-sm mt-1">Configure automatic payment reminders for your tenants</p>
      </div>
      <ReminderConfig config={config} accountId={accountId} />
    </div>
  );
}
