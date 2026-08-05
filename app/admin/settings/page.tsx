import { prisma } from "@/lib/prisma";
import { AdminSettingsForm } from "./settings-form";
import { PaymentInfoForm } from "./payment-info-form";

export default async function AdminSettingsPage() {
  const platformSettings = await prisma.platformSettings.findFirst();

  return (
    <div className="space-y-8 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your Super Admin account and platform payment info</p>
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
