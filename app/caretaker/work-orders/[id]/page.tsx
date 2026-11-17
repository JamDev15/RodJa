import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestDetail } from "@/components/operations/request-detail";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { requestDetail } from "@/lib/operations/maintenance";

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "CARETAKER") redirect(actor ? `/dashboard/operations/maintenance/${id}` : "/login");
  const d = await requestDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  return (
    <div className="space-y-4">
      <Link href="/caretaker/work-orders" className="text-sm text-th-accent hover:underline">← Work orders</Link>
      <RequestDetail d={d} apiBase={`/api/caretaker/maintenance/${d.request.id}`} viewer="CARETAKER" />
    </div>
  );
}
