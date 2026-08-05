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
        <h1 className="text-2xl font-bold text-white">Listings</h1>
        <p className="text-gray-400 text-sm mt-1">Review properties submitted for public listing</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-gray-500 text-sm">Nothing waiting on review.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((property) => (
              <div key={property.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="font-medium text-white">{property.name}</p>
                  <p className="text-xs text-gray-500">{property.address}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
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
          <h2 className="text-lg font-semibold text-white mb-3">Reviewed</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Property</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Account</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {reviewed.map((property) => (
                  <tr key={property.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{property.name}</td>
                    <td className="px-4 py-3 text-gray-400">{property.account.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={property.listingStatus === "approved" ? "success" : "destructive"}>
                        {property.listingStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatDate(property.updatedAt)}</td>
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
