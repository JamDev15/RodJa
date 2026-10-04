import Link from "next/link";
import { UserPlus, Workflow } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminSettingsForm } from "./settings-form";
import { PaymentInfoForm } from "./payment-info-form";

export default async function AdminSettingsPage() {
  const [platformSettings, signupCount, workflowCount] = await Promise.all([
    prisma.platformSettings.findFirst(),
    prisma.account.count(),
    prisma.workflow.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your Super Admin account and platform payment info</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-white">Signups &amp; CRM</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/signups" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <UserPlus className="h-5 w-5 text-purple-400" />
            <p className="mt-2 text-sm font-semibold text-white">Signups</p>
            <p className="text-xs text-gray-500">{signupCount} people — name, phone, email, social, call preference</p>
          </Link>
          <Link href="/admin/workflows" className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <Workflow className="h-5 w-5 text-purple-400" />
            <p className="mt-2 text-sm font-semibold text-white">Workflows</p>
            <p className="text-xs text-gray-500">{workflowCount} active follow-up automation{workflowCount === 1 ? "" : "s"}</p>
          </Link>
        </div>
        <p className="text-xs text-gray-500">New-signup and trial-expiry alerts go to the notification email below.</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-white">Payment Info</h2>
        <p className="text-sm text-gray-400">
          Shown to landlords when they pay their TenantHub subscription.
        </p>
        <PaymentInfoForm settings={platformSettings} />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-white">Change Password</h2>
        <AdminSettingsForm />
      </div>
    </div>
  );
}
