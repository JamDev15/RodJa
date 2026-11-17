import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ThreadView } from "@/components/operations/thread-view";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { threadDetail } from "@/lib/operations/messages";

export default async function TenantThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "TENANT") redirect("/tenant/login");
  const d = await threadDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  return (
    <div className="space-y-4">
      <Link href="/tenant/messages" className="text-sm text-th-accent hover:underline">← Messages</Link>
      <ThreadView viewer="TENANT" apiUrl={`/api/tenant/messages/${d.thread.id}`} subject={d.thread.subject} status={d.thread.status} messages={d.messages} />
    </div>
  );
}
