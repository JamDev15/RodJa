import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Building2, MapPin, Phone, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { UnitStatusBadge } from "@/components/dashboard/payment-badge";
import { SITE_URL, jsonLdString } from "@/lib/seo";

export const revalidate = 60;

// Shared between generateMetadata and the page so it's one query per request.
const getListing = cache((slug: string) =>
  prisma.property.findFirst({
    where: { isListed: true, OR: [{ slug }, { id: slug }] },
    include: { units: true, account: { select: { phone: true } } },
  })
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getListing(slug);
  if (!property) return { title: "Listing not found", robots: { index: false } };

  const vacant = property.units.filter((u) => u.status === "vacant");
  const minRent = vacant.length ? Math.min(...vacant.map((u) => u.rentAmount)) : null;
  const typeLabel = property.type ? property.type.charAt(0).toUpperCase() + property.type.slice(1) : "Rental";
  const title = `${property.name} – ${typeLabel} for rent in ${property.address}`.slice(0, 120);
  const description = [
    vacant.length ? `${vacant.length} unit${vacant.length === 1 ? "" : "s"} available` : "Currently fully occupied",
    minRent != null ? `from ${formatCurrency(minRent)}/month` : null,
    property.description?.slice(0, 140),
  ]
    .filter(Boolean)
    .join(" · ");
  const path = `/listings/${property.slug ?? property.id}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title, description },
    robots: vacant.length ? undefined : { index: false, follow: true },
  };
}

export default async function PublicListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const property = await getListing(slug);
  if (!property) notFound();

  const url = `${SITE_URL}/listings/${property.slug ?? property.id}`;
  const listingLd = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: property.name,
    url,
    description: property.description ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: property.address, addressCountry: "PH" },
    ...(property.account.phone ? { telephone: property.account.phone } : {}),
    numberOfAvailableAccommodationUnits: property.units.filter((u) => u.status === "vacant").length,
    makesOffer: property.units
      .filter((u) => u.status === "vacant")
      .map((u) => ({
        "@type": "Offer",
        name: `Unit ${u.unitNumber}`,
        price: u.rentAmount,
        priceCurrency: "PHP",
        availability: "https://schema.org/InStock",
        priceSpecification: { "@type": "UnitPriceSpecification", price: u.rentAmount, priceCurrency: "PHP", unitText: "MONTH" },
      })),
  };

  const units = [...property.units].sort((a, b) => (a.status === "vacant" ? -1 : 1) - (b.status === "vacant" ? -1 : 1));

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(listingLd) }} />
      <Link href="/listings" className="inline-flex items-center gap-1.5 text-sm text-th-muted hover:text-th-ink transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
      </Link>

      <div className="flex h-48 items-center justify-center rounded-xl bg-gradient-to-br from-th-accent/20 to-th-accent/5 mb-6">
        <Building2 className="h-14 w-14 text-th-accent/60" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-th-ink">{property.name}</h1>
        <span className="rounded-full border border-th-line bg-th-surface px-3 py-1 text-xs text-th-ink/80 capitalize">{property.type}</span>
      </div>
      <p className="flex items-center gap-1.5 text-th-muted mb-8">
        <MapPin className="h-4 w-4 shrink-0" /> {property.address}
      </p>

      {property.description && (
        <p className="text-th-ink/80 leading-relaxed mb-8">{property.description}</p>
      )}

      <h2 className="text-lg font-semibold text-th-ink mb-3">Units</h2>
      <div className="space-y-3 mb-8">
        {units.map((unit) => (
          <div key={unit.id} className="flex items-center justify-between rounded-xl border border-th-line bg-th-surface p-4">
            <div>
              <p className="font-medium text-th-ink">
                Unit {unit.unitNumber}
                {unit.floor && <span className="text-th-faint font-normal"> · {unit.floor}</span>}
              </p>
              {unit.description && <p className="text-xs text-th-faint mt-0.5">{unit.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-th-ink">{formatCurrency(unit.rentAmount)}/mo</p>
                {unit.depositAmount != null && <p className="text-xs text-th-faint">{formatCurrency(unit.depositAmount)} deposit</p>}
              </div>
              <UnitStatusBadge status={unit.status} />
            </div>
          </div>
        ))}
      </div>

      {property.account.phone && (
        <div className="rounded-xl border border-th-accent/30 bg-th-brand-soft p-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-th-brand-soft">
            <Phone className="h-5 w-5 text-th-accent" />
          </div>
          <div>
            <p className="text-sm text-th-muted">Interested? Contact the landlord</p>
            <p className="font-semibold text-th-ink">{property.account.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
}
