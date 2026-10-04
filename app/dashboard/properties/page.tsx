import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Building2, MapPin, Home } from "lucide-react";
import { UnitStatusBadge } from "@/components/dashboard/payment-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function PropertiesPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const properties = await prisma.property.findMany({
    where: { accountId },
    include: {
      units: {
        include: { tenants: { where: { isActive: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Properties</h1>
          <p className="text-th-muted text-sm mt-1">{properties.length} properties</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="flex items-center gap-2 rounded-lg bg-th-brand px-4 py-2 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Property
        </Link>
      </div>

      {properties.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-th-line py-16 text-center">
          <Building2 className="h-12 w-12 text-th-faint mb-4" />
          <p className="text-th-muted font-medium">No properties yet</p>
          <p className="text-th-faint text-sm mb-4">Add your first property to get started</p>
          <Link href="/dashboard/properties/new" className="rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">
            Add Property
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {properties.map((property) => {
          const totalUnits = property.units.length;
          const occupiedUnits = property.units.filter((u) => u.status === "occupied").length;
          const vacantUnits = property.units.filter((u) => u.status === "vacant").length;
          const monthlyRevenue = property.units
            .filter((u) => u.status === "occupied")
            .reduce((s, u) => s + u.rentAmount, 0);

          return (
            <Link
              key={property.id}
              href={`/dashboard/properties/${property.id}`}
              className="block rounded-xl border border-th-line bg-th-surface p-5 hover:bg-th-raised hover:border-th-faint/40 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-th-brand-soft">
                    <Building2 className="h-5 w-5 text-th-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-th-ink">{property.name}</h3>
                    <p className="text-xs text-th-faint capitalize">{property.type.replace("_", " ")}</p>
                  </div>
                </div>
                {property.isListed && (
                  <Badge variant="success" className="text-xs">Listed</Badge>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-th-faint mb-4">
                <MapPin className="h-3 w-3" />
                {property.address}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-th-surface py-2">
                  <p className="text-lg font-bold text-th-ink">{totalUnits}</p>
                  <p className="text-xs text-th-faint">Units</p>
                </div>
                <div className="rounded-lg bg-th-paid-soft py-2">
                  <p className="text-lg font-bold text-th-paid">{occupiedUnits}</p>
                  <p className="text-xs text-th-faint">Occupied</p>
                </div>
                <div className="rounded-lg bg-th-brand-soft py-2">
                  <p className="text-lg font-bold text-th-accent">{vacantUnits}</p>
                  <p className="text-xs text-th-faint">Vacant</p>
                </div>
              </div>

              {monthlyRevenue > 0 && (
                <div className="mt-3 pt-3 border-t border-th-line flex items-center justify-between">
                  <span className="text-xs text-th-faint">Monthly Revenue</span>
                  <span className="text-sm font-semibold text-th-ink">{formatCurrency(monthlyRevenue)}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
