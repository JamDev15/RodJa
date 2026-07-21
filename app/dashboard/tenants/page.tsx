import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Users, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function TenantsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const tenants = await prisma.tenant.findMany({
    where: { unit: { property: { accountId } } },
    include: {
      unit: { include: { property: true } },
      payments: { orderBy: { dueDate: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const active = tenants.filter((t) => t.isActive);
  const inactive = tenants.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-400 text-sm mt-1">{active.length} active · {inactive.length} past</p>
        </div>
        <Link
          href="/dashboard/tenants/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Tenant
        </Link>
      </div>

      {tenants.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
          <Users className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">No tenants yet</p>
          <p className="text-gray-600 text-sm mb-4">Add your first tenant to get started</p>
          <Link href="/dashboard/tenants/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Add Tenant
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Unit</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Phone</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Move-in</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Last Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {tenants.map((tenant) => {
              const lastPayment = tenant.payments[0];
              return (
                <tr key={tenant.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tenants/${tenant.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                      {tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {tenant.unit.property.name} – {tenant.unit.unitNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{tenant.phone}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{formatDate(tenant.moveInDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={tenant.isActive ? "success" : "secondary"}>
                      {tenant.isActive ? "Active" : "Past"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {lastPayment ? (
                      <span className={lastPayment.status === "approved" ? "text-green-400" : lastPayment.status === "late" ? "text-red-400" : "text-yellow-400"}>
                        {lastPayment.month}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
