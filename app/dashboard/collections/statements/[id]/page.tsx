import Link from "next/link";
import { ActionForm } from "@/components/collections/action-form";
import { Money, Pill } from "@/components/collections/bits";
import { StatementDocument } from "@/components/collections/statement-document";
import { currentActor } from "@/lib/collections/actor";
import { formatDateOnly } from "@/lib/collections/calendar";
import { statementDetail } from "@/lib/collections/views";
import { notFound, redirect } from "next/navigation";
import { BillingError } from "@/lib/collections/errors";

export default async function AdminStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const d = await statementDetail(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  const isDraft = d.statement.status === "DRAFT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/dashboard/collections/statements?propertyId=${d.property.id}&period=${d.statement.periodKey}`} className="text-sm text-th-accent hover:underline">← All statements for this cycle</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Pill status={d.statement.settlement ?? d.statement.status} />
          {d.statement.sentAt ? <span className="text-xs text-th-muted">Emailed {formatDateOnly(d.statement.sentAt.slice(0, 10))}</span> : null}
        </div>
      </div>

      {isDraft && (
        <div className="space-y-3 rounded-xl border border-th-due/40 bg-th-due-soft p-4 print:hidden">
          <p className="text-sm text-th-due"><strong>Draft.</strong> The tenant can&apos;t see this yet and nothing is owed until you issue it.</p>
          <div className="flex flex-wrap items-start gap-2">
            <ActionForm url={`/api/collections/statements/${d.statement.id}`} body={{ action: "publish" }} submitLabel="Issue statement" variant="success" successMessage="Statement issued" />
            <ActionForm
              url={`/api/collections/statements/${d.statement.id}`}
              body={{ action: "add_charge" }}
              toggleLabel="Add a charge"
              submitLabel="Add to this statement"
              successMessage="Charge added"
              fields={[
                { name: "type", label: "Type", type: "select", options: [{ value: "MISC", label: "Miscellaneous" }, { value: "PARKING", label: "Parking (one-off)" }] },
                { name: "description", label: "Description (required)", type: "text", required: true, placeholder: "e.g. Replaced door lock" },
                { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
              ]}
            />
            <ActionForm url={`/api/collections/statements/${d.statement.id}`} body={{ action: "discard" }} toggleLabel="Discard draft" submitLabel="Yes, discard this draft" variant="destructive" redirectTo={`/dashboard/collections/statements?propertyId=${d.property.id}&period=${d.statement.periodKey}`} />
          </div>
        </div>
      )}

      {!isDraft && (
        <div className="flex flex-wrap items-start gap-2 print:hidden">
          <ActionForm url={`/api/collections/statements/${d.statement.id}`} body={{ action: "send" }} submitLabel={d.statement.sentAt ? "Email again" : "Email to tenant now"} variant="outline" successMessage="Sent" />
          <Link href={`/dashboard/collections/tenants/${d.tenant.id}`} className="inline-flex h-8 items-center rounded-lg border border-th-line px-3 text-xs text-th-ink hover:bg-th-raised">Tenant ledger & payments</Link>
        </div>
      )}

      <StatementDocument d={d} />

      <section className="space-y-3 print:hidden">
        <h2 className="text-base font-semibold text-th-ink">Lines</h2>
        {d.lines.map((l) => (
          <div key={l.id} className="rounded-xl border border-th-line bg-th-surface p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-th-ink">{l.description}</span>
              <span className="flex items-center gap-3">
                <Money c={l.amountCentavos} />
                {!isDraft && <span className="text-xs text-th-muted">unpaid <Money c={l.outstandingCentavos} /></span>}
              </span>
            </div>
            {l.adjustments.map((a) => (
              <p key={a.id} className={`mt-1 text-xs ${a.reversedAt ? "text-th-faint line-through" : "text-th-muted"}`}>
                {a.kind === "WAIVER" ? "Waived" : "Reduced"} <Money c={a.amountCentavos} />: {a.reason}
              </p>
            ))}
            {l.allocations.filter((a) => !a.reversedAt).map((a) => (
              <p key={a.id} className="mt-1 text-xs text-th-paid">Paid <Money c={a.amountCentavos} /> · receipt {a.receiptNumber} ({formatDateOnly(a.paidOn)})</p>
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              {isDraft ? (
                <ActionForm url={`/api/collections/charges/${l.id}`} method="DELETE" submitLabel="Remove line" variant="outline" successMessage="Line removed" />
              ) : l.netCentavos > 0 ? (
                <>
                  <ActionForm url={`/api/collections/charges/${l.id}`} body={{ kind: "WAIVER" }} toggleLabel={l.type === "PENALTY" ? "Waive penalty" : "Waive"} fields={[{ name: "reason", label: "Reason", type: "text", required: true }]} submitLabel="Waive" variant="outline" successMessage="Waived" />
                  <ActionForm url={`/api/collections/charges/${l.id}`} body={{ kind: "REDUCTION" }} toggleLabel="Reduce" fields={[{ name: "amountCentavos", label: "Reduce by (₱)", type: "pesos", required: true }, { name: "reason", label: "Reason", type: "text", required: true }]} submitLabel="Reduce" variant="outline" successMessage="Reduced" />
                </>
              ) : null}
              {l.adjustments.filter((a) => !a.reversedAt).map((a) => (
                <ActionForm key={a.id} url={`/api/collections/adjustments/${a.id}`} toggleLabel="Undo adjustment" fields={[{ name: "reason", label: "Why undo?", type: "text", required: true }]} submitLabel="Undo" variant="outline" successMessage="Adjustment undone" />
              ))}
            </div>
          </div>
        ))}
        {d.lines.length === 0 && <p className="text-sm text-th-muted">No lines on this statement.</p>}
      </section>
    </div>
  );
}
