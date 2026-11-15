import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestDetail } from "@/components/operations/request-detail";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { assignees, requestDetail } from "@/lib/operations/maintenance";

export default async function MaintenanceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const d = await requestDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  const people = d.property ? await assignees(actor, d.property.id) : [];
  return (
    <div className="space-y-4">
      <Link href={`/dashboard/operations/maintenance${d.property ? `?propertyId=${d.property.id}` : ""}`} className="text-sm text-th-accent hover:underline">← Maintenance</Link>
      <RequestDetail d={d} apiBase={`/api/operations/maintenance/${d.request.id}`} viewer="ADMIN" people={people} />
    </div>
  );
}
