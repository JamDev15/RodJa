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
        <Link href="/dashboard/properties" className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-th-ink">{property.name}</h1>
          <div className="flex items-center gap-1 text-sm text-th-muted">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}
          </div>
        </div>
        <Link
          href={`/dashboard/properties/${id}/units/new`}
          className="flex items-center gap-2 rounded-lg bg-th-brand px-4 py-2 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Unit
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Units", value: property.units.length, color: "text-th-ink" },
          { label: "Occupied", value: property.units.filter(u => u.status === "occupied").length, color: "text-th-paid" },
          { label: "Vacant", value: property.units.filter(u => u.status === "vacant").length, color: "text-th-accent" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-th-line bg-th-surface p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-th-faint mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Units Grid */}
      <div>
        <h2 className="text-lg font-semibold text-th-ink mb-3">Units</h2>
        {property.units.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-th-line py-12 text-center">
            <Home className="h-10 w-10 text-th-faint mb-3" />
            <p className="text-th-muted">No units yet</p>
            <Link href={`/dashboard/properties/${id}/units/new`} className="mt-3 rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">
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
