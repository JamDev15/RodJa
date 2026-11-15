import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestDetail } from "@/components/operations/request-detail";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { requestDetail } from "@/lib/operations/maintenance";

export default async function TenantRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "TENANT") redirect("/tenant/login");
  const d = await requestDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  return (
    <div className="space-y-4">
      <Link href="/tenant/maintenance" className="text-sm text-th-accent hover:underline">← Repairs</Link>
      <RequestDetail d={d} apiBase={`/api/tenant/maintenance/${d.request.id}`} viewer="TENANT" />
    </div>
  );
}
