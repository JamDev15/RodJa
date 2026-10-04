import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ListingActions } from "./listing-actions";

export default async function AdminListingsPage() {
  const properties = await prisma.property.findMany({
    where: { listingStatus: { not: "unlisted" } },
    include: { account: { select: { name: true, ownerName: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const pending = properties.filter((p) => p.listingStatus === "pending");
  const reviewed = properties.filter((p) => p.listingStatus !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-th-ink">Listings</h1>
        <p className="text-th-muted text-sm mt-1">Review properties submitted for public listing</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-th-ink mb-3">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-th-faint text-sm">Nothing waiting on review.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((property) => (
              <div key={property.id} className="flex items-center justify-between rounded-xl border border-th-line bg-th-surface p-4">
                <div>
                  <p className="font-medium text-th-ink">{property.name}</p>
                  <p className="text-xs text-th-faint">{property.address}</p>
                  <p className="text-xs text-th-faint mt-0.5">
                    {property.account.name} ({property.account.ownerName}) · Updated {formatDate(property.updatedAt)}
                  </p>
                </div>
                <ListingActions propertyId={property.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-th-ink mb-3">Reviewed</h2>
          <div className="rounded-xl border border-th-line overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-line bg-th-surface">
                  <th className="text-left px-4 py-3 text-th-muted font-medium">Property</th>
                  <th className="text-left px-4 py-3 text-th-muted font-medium">Account</th>
                  <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-th-muted font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-line">
                {reviewed.map((property) => (
                  <tr key={property.id} className="hover:bg-th-raised">
                    <td className="px-4 py-3 text-th-ink">{property.name}</td>
                    <td className="px-4 py-3 text-th-muted">{property.account.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={property.listingStatus === "approved" ? "success" : "destructive"}>
                        {property.listingStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-th-muted">{formatDate(property.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
