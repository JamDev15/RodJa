import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pill } from "@/components/collections/bits";
import { StatementDocument } from "@/components/collections/statement-document";
import { currentActor } from "@/lib/collections/actor";
import { BillingError } from "@/lib/collections/errors";
import { statementDetail } from "@/lib/collections/views";

export default async function TenantStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "TENANT") redirect("/tenant/login");
  const d = await statementDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/tenant/billing" className="text-sm text-th-accent hover:underline">← Bills</Link>
        {d.statement.settlement && <Pill status={d.statement.settlement} />}
      </div>
      <StatementDocument d={d} />
      <Link href="/tenant/billing" className="block rounded-lg bg-th-brand py-2.5 text-center text-sm font-medium text-th-on-brand print:hidden">Upload a payment</Link>
    </div>
  );
}
