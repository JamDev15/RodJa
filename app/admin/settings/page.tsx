import { AdminSettingsForm } from "./settings-form";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your Super Admin account</p>
      </div>
      <AdminSettingsForm />
    </div>
  );
}
