import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Pill, Section, Stat } from "@/components/collections/bits";
import { currentActor } from "@/lib/collections/actor";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";
import { BillingError } from "@/lib/collections/errors";
import { settlementStatus } from "@/lib/collections/statement-math";
import { tenantLedgerAdminView } from "@/lib/collections/views";

const ACTION_LABEL: Record<string, string> = {
  submitted: "Payment submitted",
  approved: "Payment approved",
  rejected: "Payment rejected",
  reversed: "Payment reversed",
  recorded_by_admin: "Payment recorded",
  waived: "Charge waived",
  reduced: "Charge reduced",
  adjustment_reversed: "Adjustment undone",
  published: "Statement issued",
  draft_generated: "Draft prepared",
  draft_refreshed: "Draft refreshed",
  draft_discarded: "Draft discarded",
  draft_charge_added: "Charge added to draft",
  draft_charge_removed: "Line removed from draft",
  opening_balance_recorded: "Opening balance recorded",
  tenant_billing_updated: "Billing details changed",
  veco_submitted: "VECO receipt uploaded",
  veco_verified: "VECO receipt verified",
  veco_rejected: "VECO receipt rejected",
  excess_approved: "Water excess approved",
  excess_rejected: "Water excess rejected",
};

export default async function TenantCollectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const v = await tenantLedgerAdminView(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  const { tenant, ledger, today } = v;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/collections?propertyId=${tenant.unit.propertyId}`} className="text-sm text-th-accent hover:underline">← Collections</Link>
        <h1 className="mt-2 text-2xl font-bold text-th-ink">{tenant.name}</h1>
        <p className="text-sm text-th-muted">
          Room {tenant.unit.unitNumber} · {tenant.unit.property.name} · {tenant.isActive ? "current tenant" : "moved out"} ·{" "}
          <Link href={`/dashboard/tenants/${tenant.id}`} className="text-th-accent hover:underline">tenant profile</Link> ·{" "}
          <Link href={`/dashboard/operations/tenancies/${tenant.id}`} className="text-th-accent hover:underline">household, lease &amp; deposit</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding" value={<Money c={ledger.outstandingCentavos} />} tone={ledger.outstandingCentavos ? "due" : undefined} />
        <Stat label="Overdue" value={<Money c={ledger.overdueCentavos} />} tone={ledger.overdueCentavos ? "danger" : undefined} />
        <Stat label="Unapplied credit" value={<Money c={ledger.creditCentavos} />} hint="Applied automatically to the next charges" />
        <Stat label="Occupants" value={tenant.occupantCount ?? "Not set"} hint={tenant.penaltyExempt ? `Penalty exempt: ${tenant.penaltyExemptReason}` : undefined} />
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <ActionForm
          url={`/api/collections/tenants/${tenant.id}`}
          body={{ action: "record_payment" }}
          withRequestId
          toggleLabel="Record a payment received"
          submitLabel="Record and approve"
          variant="success"
          successMessage="Payment recorded and applied"
          fields={[
            { name: "amountCentavos", label: "Amount received (₱)", type: "pesos", required: true },
            { name: "method", label: "Method", type: "select", options: [{ value: "cash", label: "Cash" }, { value: "gcash", label: "GCash" }, { value: "maya", label: "Maya" }, { value: "bank", label: "Bank transfer" }, { value: "other", label: "Other" }] },
            { name: "paidOn", label: "Date received", type: "date", required: true, defaultValue: today },
            { name: "referenceNumber", label: "Reference / OR number", type: "text" },
            { name: "notes", label: "Notes", type: "text" },
          ]}
        />
        <ActionForm
          url={`/api/collections/tenants/${tenant.id}`}
          body={{ action: "billing" }}
          toggleLabel="Occupants & penalty exemption"
          submitLabel="Save"
          successMessage="Saved"
          fields={[
            { name: "occupantCount", label: "Occupants in the room (1–4)", type: "number", defaultValue: tenant.occupantCount != null ? String(tenant.occupantCount) : "", hint: "Drives the monthly water charge. Blank = no automatic water charge." },
            { name: "penaltyExempt", label: "Exempt from automatic late penalties", type: "checkbox", defaultValue: tenant.penaltyExempt },
            { name: "penaltyExemptReason", label: "Reason for exemption", type: "text", defaultValue: tenant.penaltyExemptReason ?? "" },
          ]}
        />
        {!ledger.charges.some((c) => c.type === "OPENING_BALANCE") && (
          <ActionForm
            url={`/api/collections/tenants/${tenant.id}`}
            body={{ action: "opening_balance" }}
            toggleLabel="Bring in an existing balance"
            submitLabel="Record opening balance"
            successMessage="Opening balance recorded"
            fields={[
              { name: "amountCentavos", label: "Amount owed before this system (₱)", type: "pesos", required: true },
              { name: "asOfDate", label: "As of", type: "date", required: true, defaultValue: today },
              { name: "description", label: "Where it comes from", type: "text", required: true, placeholder: "e.g. Unpaid Oct 2026 rent from the old ledger" },
            ]}
          />
        )}
      </div>

      <Section title="Statements">
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {v.statements.length === 0 && <li className="p-4 text-sm text-th-muted">No statements yet.</li>}
          {v.statements.map((s) => {
            const lines = ledger.charges.filter((c) => c.statementId === s.id);
            const status = s.status === "PUBLISHED" ? settlementStatus(lines, fromDbDate(s.dueDate), today) : "DRAFT";
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/dashboard/collections/statements/${s.id}`} className="text-th-accent hover:underline">
                  {s.number ?? "Draft"} · {formatDateOnly(fromDbDate(s.cycleDate))} cycle
                </Link>
                <span className="flex items-center gap-3">
                  {s.totalDueCentavos != null && <span className="text-th-muted">issued total <Money c={s.totalDueCentavos} /></span>}
                  <Pill status={status} />
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Payments">
        <div className="space-y-3">
          {v.payments.length === 0 && <p className="text-sm text-th-muted">No payments yet.</p>}
          {v.payments.map((p) => {
            const active = p.allocations.filter((a) => !a.reversedAt).reduce((s, a) => s + a.amountCentavos, 0);
            return (
              <div key={p.id} className="rounded-xl border border-th-line bg-th-surface p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-th-ink">
                    <Money c={p.amountCentavos} className="font-semibold" /> · {p.method.toUpperCase()} · paid {formatDateOnly(fromDbDate(p.paidOn))}
                    {p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""} {p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill status={p.status} />
                    <FileLink id={p.proofFileId} />
                    {p.status === "APPROVED" && p.receiptNumber && <a href={`/api/files/receipts/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-th-accent hover:underline">Receipt PDF</a>}
                  </span>
                </div>
                {p.status === "APPROVED" && <p className="mt-1 text-xs text-th-muted">Applied <Money c={active} />{p.amountCentavos > active ? <> · credit <Money c={p.amountCentavos - active} /></> : null}</p>}
                {p.rejectedReason && <p className="mt-1 text-xs text-th-danger">Rejected: {p.rejectedReason}</p>}
                {p.reversalReason && <p className="mt-1 text-xs text-th-muted">Reversed: {p.reversalReason}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.status === "PENDING" && (
                    <>
                      <ActionForm url={`/api/collections/payments/${p.id}`} body={{ action: "approve" }} submitLabel="Approve" variant="success" successMessage="Approved" />
                      <ActionForm url={`/api/collections/payments/${p.id}`} body={{ action: "reject" }} toggleLabel="Reject" fields={[{ name: "reason", label: "Reason", type: "text", required: true }]} submitLabel="Reject" variant="destructive" successMessage="Rejected" />
                    </>
                  )}
                  {p.status === "APPROVED" && (
                    <ActionForm url={`/api/collections/payments/${p.id}`} body={{ action: "reverse" }} toggleLabel="Reverse" fields={[{ name: "reason", label: "Why is this payment being reversed?", type: "text", required: true }]} submitLabel="Reverse payment" variant="destructive" successMessage="Payment reversed" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="History">
        <ul className="space-y-1 text-xs text-th-muted">
          {v.audits.map((a) => (
            <li key={a.id}>
              {a.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · {ACTION_LABEL[a.action] ?? a.action} · by {a.actorRole.toLowerCase()}
              {a.details && typeof a.details === "object" && "reason" in (a.details as object) && (a.details as { reason?: string }).reason ? ` — ${(a.details as { reason: string }).reason}` : ""}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
