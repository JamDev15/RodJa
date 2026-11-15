import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { ThreadView } from "@/components/operations/thread-view";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { threadDetail } from "@/lib/operations/messages";

export default async function AdminThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const d = await threadDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dashboard/operations/inbox?propertyId=${d.thread.propertyId}`} className="text-sm text-th-accent hover:underline">← Inbox</Link>
        <span className="flex items-center gap-3 text-sm">
          {d.tenant && <Link href={`/dashboard/operations/tenancies/${d.tenant.id}`} className="text-th-accent hover:underline">Room {d.tenant.unit.unitNumber} · {d.tenant.name}</Link>}
          <ActionForm url={`/api/operations/messages/${d.thread.id}/status`} body={{ status: d.thread.status === "CLOSED" ? "OPEN" : "CLOSED" }} submitLabel={d.thread.status === "CLOSED" ? "Reopen" : "Close"} variant="outline" />
        </span>
      </div>
      <ThreadView viewer="ADMIN" apiUrl={`/api/operations/messages/${d.thread.id}`} subject={d.thread.subject} status={d.thread.status} messages={d.messages} />
    </div>
  );
}
