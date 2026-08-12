import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Building2, MapPin, DoorOpen } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 60;

export default async function PublicListingsPage() {
  const properties = await prisma.property.findMany({
    where: { isListed: true, units: { some: { status: "vacant" } } },
    include: { units: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Available Rentals</h1>
        <p className="text-gray-400">Vacant units from landlords using TenantHub.</p>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20 text-center">
          <Building2 className="h-12 w-12 text-gray-600 mb-4" />
          <p className="text-gray-400 font-medium">No listings available right now</p>
          <p className="text-gray-600 text-sm mt-1">Check back soon — new vacancies are added regularly.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const vacantUnits = property.units.filter((u) => u.status === "vacant");
            const minRent = Math.min(...vacantUnits.map((u) => u.rentAmount));
            return (
              <Link
                key={property.id}
                href={`/listings/${property.slug ?? property.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 hover:bg-white/[0.07] transition-all hover:-translate-y-0.5"
              >
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-blue-600/20 to-blue-500/5">
                  <Building2 className="h-10 w-10 text-blue-400/60" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">{property.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <MapPin className="h-3 w-3 shrink-0" /> {property.address}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-gray-400">
                      <DoorOpen className="h-3.5 w-3.5" /> {vacantUnits.length} unit{vacantUnits.length !== 1 ? "s" : ""} available
                    </span>
                    <span className="font-semibold text-white">from {formatCurrency(minRent)}/mo</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
