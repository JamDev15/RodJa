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
        <h1 className="text-2xl font-bold text-th-ink">Settings</h1>
        <p className="text-th-muted text-sm mt-1">Manage your Super Admin account and platform payment info</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-th-ink">Signups &amp; CRM</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/signups" className="rounded-xl border border-th-line bg-th-surface p-4 hover:bg-th-raised">
            <UserPlus className="h-5 w-5 text-th-violet" />
            <p className="mt-2 text-sm font-semibold text-th-ink">Signups</p>
            <p className="text-xs text-th-faint">{signupCount} people — name, phone, email, social, call preference</p>
          </Link>
          <Link href="/admin/workflows" className="rounded-xl border border-th-line bg-th-surface p-4 hover:bg-th-raised">
            <Workflow className="h-5 w-5 text-th-violet" />
            <p className="mt-2 text-sm font-semibold text-th-ink">Workflows</p>
            <p className="text-xs text-th-faint">{workflowCount} active follow-up automation{workflowCount === 1 ? "" : "s"}</p>
          </Link>
        </div>
        <p className="text-xs text-th-faint">New-signup and trial-expiry alerts go to the notification email below.</p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-th-ink">Payment Info</h2>
        <p className="text-sm text-th-muted">
          Shown to landlords when they pay their TenantHub subscription.
        </p>
        <PaymentInfoForm settings={platformSettings} />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-th-ink">Change Password</h2>
        <AdminSettingsForm />
      </div>
    </div>
  );
}
