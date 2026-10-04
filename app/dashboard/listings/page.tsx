import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Globe, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function ListingsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const properties = await prisma.property.findMany({
    where: { accountId },
    include: { units: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Public Listings</h1>
        <p className="text-th-muted text-sm mt-1">Submit properties for public listing to attract new tenants</p>
      </div>

      <div className="rounded-xl border border-th-line bg-th-surface p-4 text-sm text-th-muted">
        Submitting a property for listing will send it to the platform admin for review. Once approved, it will appear on the public listings page.
      </div>

      <div className="space-y-3">
        {properties.map((property) => {
          const vacantUnits = property.units.filter((u) => u.status === "vacant").length;
          return (
            <div key={property.id} className="flex items-center justify-between rounded-xl border border-th-line bg-th-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-th-raised">
                  <Building2 className="h-5 w-5 text-th-muted" />
                </div>
                <div>
                  <p className="font-medium text-th-ink">{property.name}</p>
                  <p className="text-xs text-th-faint">{property.address} · {vacantUnits} vacant unit{vacantUnits !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={
                  property.listingStatus === "approved" ? "success" :
                  property.listingStatus === "pending" ? "warning" :
                  property.listingStatus === "rejected" ? "destructive" : "secondary"
                }>
                  {property.listingStatus === "unlisted" ? "Not Listed" : property.listingStatus}
                </Badge>
                {property.listingStatus !== "pending" && property.listingStatus !== "approved" && (
                  <form action={`/api/listings/${property.id}/submit`} method="POST">
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-lg bg-th-brand px-3 py-1.5 text-xs font-medium text-th-on-brand hover:bg-th-brand-hover transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {property.listingStatus === "rejected" ? "Resubmit" : "Submit for Listing"}
                    </button>
                  </form>
                )}
                {property.listingStatus === "approved" && property.slug && (
                  <Link
                    href={`/listings/${property.slug}`}
                    target="_blank"
                    className="text-xs text-th-accent hover:text-th-accent"
                  >
                    View Listing →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
