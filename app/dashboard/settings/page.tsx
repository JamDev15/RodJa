import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;

  const account = await prisma.account.findUnique({ where: { id: accountId } });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Account Settings</h1>
        <p className="text-th-muted text-sm mt-1">Manage your account and payment details</p>
      </div>
      <Link href="/dashboard/settings/integrations" className="flex items-center justify-between rounded-xl border border-th-line bg-th-surface p-4 hover:bg-th-raised">
        <span>
          <span className="block text-sm font-medium text-th-ink">Integrations</span>
          <span className="text-xs text-th-muted">Connect your Facebook Page for Messenger alerts</span>
        </span>
        <span className="text-th-faint">→</span>
      </Link>
      <SettingsForm account={account} />
      {user?.role === "LANDLORD" && <ChangePasswordForm />}
    </div>
  );
}
