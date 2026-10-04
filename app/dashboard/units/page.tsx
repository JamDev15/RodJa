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
          <h1 className="text-2xl font-bold text-th-ink">Units</h1>
          <p className="text-th-muted text-sm mt-1">{units.length} of {allUnits.length} units</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/dashboard/units?status=${f.value}` : "/dashboard/units"}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                (status ?? "") === f.value
                  ? "bg-th-brand text-th-on-brand"
                  : "bg-th-surface text-th-muted border border-th-line hover:bg-th-raised"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {allUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-th-line py-16 text-center">
          <Home className="h-12 w-12 text-th-faint mb-4" />
          <p className="text-th-muted font-medium">No units yet</p>
          <p className="text-th-faint text-sm mb-4">Add a property, then add units to it</p>
          <Link href="/dashboard/properties" className="rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">
            Go to Properties
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-th-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface">
                <th className="text-left px-4 py-3 text-th-muted font-medium">Unit</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Property</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Rent</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden lg:table-cell">Tenant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-line">
              {units.length === 0 && (
                <tr><td colSpan={5} className="text-center text-th-faint py-8">No units match this filter</td></tr>
              )}
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-th-raised transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/units/${u.id}`} className="font-medium text-th-ink hover:text-th-accent transition-colors">
                      Unit {u.unitNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-th-muted hidden md:table-cell">{u.propertyName}</td>
                  <td className="px-4 py-3"><UnitStatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-th-ink">{formatCurrency(u.rentAmount)}</td>
                  <td className="px-4 py-3 text-th-muted hidden lg:table-cell">
                    {u.tenant ? (
                      <Link href={`/dashboard/tenants/${u.tenant.id}`} className="hover:text-th-accent">{u.tenant.name}</Link>
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
