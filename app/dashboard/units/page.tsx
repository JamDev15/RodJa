import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Home } from "lucide-react";
import { UnitStatusBadge } from "@/components/dashboard/payment-badge";
import { formatCurrency } from "@/lib/utils";

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const properties = await prisma.property.findMany({
    where: { accountId },
    include: {
      units: {
        include: { tenants: { where: { isActive: true }, take: 1 } },
        orderBy: { unitNumber: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const allUnits = properties.flatMap((p) =>
    p.units.map((u) => ({ ...u, propertyName: p.name, tenant: u.tenants[0] ?? null }))
  );
  const units = status ? allUnits.filter((u) => u.status === status) : allUnits;

  const statusFilters = [
    { value: "", label: "All" },
    { value: "occupied", label: "Occupied" },
    { value: "vacant", label: "Vacant" },
    { value: "maintenance", label: "Maintenance" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Units</h1>
          <p className="text-gray-400 text-sm mt-1">{units.length} of {allUnits.length} units</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/dashboard/units?status=${f.value}` : "/dashboard/units"}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                (status ?? "") === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {allUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
          <Home className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">No units yet</p>
          <p className="text-gray-600 text-sm mb-4">Add a property, then add units to it</p>
          <Link href="/dashboard/properties" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Go to Properties
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Unit</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Property</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Rent</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Tenant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {units.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-8">No units match this filter</td></tr>
              )}
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/units/${u.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                      Unit {u.unitNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{u.propertyName}</td>
                  <td className="px-4 py-3"><UnitStatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-white">{formatCurrency(u.rentAmount)}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {u.tenant ? (
                      <Link href={`/dashboard/tenants/${u.tenant.id}`} className="hover:text-blue-400">{u.tenant.name}</Link>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
