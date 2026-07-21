import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Home, MapPin } from "lucide-react";
import { UnitCard } from "@/components/dashboard/unit-card";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const property = await prisma.property.findFirst({
    where: { id, accountId },
    include: {
      units: {
        include: {
          tenants: {
            where: { isActive: true },
            include: {
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
    },
  });

  if (!property) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/properties" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{property.name}</h1>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}
          </div>
        </div>
        <Link
          href={`/dashboard/properties/${id}/units/new`}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Unit
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Units", value: property.units.length, color: "text-white" },
          { label: "Occupied", value: property.units.filter(u => u.status === "occupied").length, color: "text-green-400" },
          { label: "Vacant", value: property.units.filter(u => u.status === "vacant").length, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Units Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Units</h2>
        {property.units.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-12 text-center">
            <Home className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-gray-400">No units yet</p>
            <Link href={`/dashboard/properties/${id}/units/new`} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Add Unit
            </Link>
          </div>
        )}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {property.units.map((unit) => {
            const currentTenant = unit.tenants[0];
            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                tenantName={currentTenant?.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
