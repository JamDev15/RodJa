import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const account = await prisma.account.findUnique({ where: { id: accountId } });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account and payment details</p>
      </div>
      <SettingsForm account={account} />
    </div>
  );
}
