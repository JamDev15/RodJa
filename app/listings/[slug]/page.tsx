import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Building2, MapPin, Phone, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { UnitStatusBadge } from "@/components/dashboard/payment-badge";

export const revalidate = 60;

export default async function PublicListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const property = await prisma.property.findFirst({
    where: { isListed: true, OR: [{ slug }, { id: slug }] },
    include: { units: true, account: { select: { phone: true } } },
  });
  if (!property) notFound();

  const units = [...property.units].sort((a, b) => (a.status === "vacant" ? -1 : 1) - (b.status === "vacant" ? -1 : 1));

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
      </Link>

      <div className="flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-500/5 mb-6">
        <Building2 className="h-14 w-14 text-blue-400/60" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-white">{property.name}</h1>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 capitalize">{property.type}</span>
      </div>
      <p className="flex items-center gap-1.5 text-gray-400 mb-8">
        <MapPin className="h-4 w-4 shrink-0" /> {property.address}
      </p>

      {property.description && (
        <p className="text-gray-300 leading-relaxed mb-8">{property.description}</p>
      )}

      <h2 className="text-lg font-semibold text-white mb-3">Units</h2>
      <div className="space-y-3 mb-8">
        {units.map((unit) => (
          <div key={unit.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium text-white">
                Unit {unit.unitNumber}
                {unit.floor && <span className="text-gray-500 font-normal"> · {unit.floor}</span>}
              </p>
              {unit.description && <p className="text-xs text-gray-500 mt-0.5">{unit.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-white">{formatCurrency(unit.rentAmount)}/mo</p>
                {unit.depositAmount != null && <p className="text-xs text-gray-500">{formatCurrency(unit.depositAmount)} deposit</p>}
              </div>
              <UnitStatusBadge status={unit.status} />
            </div>
          </div>
        ))}
      </div>

      {property.account.phone && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
            <Phone className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Interested? Contact the landlord</p>
            <p className="font-semibold text-white">{property.account.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
}
