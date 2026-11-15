import Link from "next/link";
import { redirect } from "next/navigation";
import { FileLink, Money, Pill } from "@/components/collections/bits";
import { PaymentProofForm, VecoReceiptForm } from "@/components/collections/tenant-forms";
import { currentActor } from "@/lib/collections/actor";
import { addMonths, formatDateOnly, formatMonth, monthOf } from "@/lib/collections/calendar";
import { tenantBillingView } from "@/lib/collections/views";

const METHOD: Record<string, string> = { gcash: "GCash", maya: "Maya", bank: "Bank", cash: "Cash", other: "Other" };

export default async function TenantBillingPage() {
  const actor = await currentActor();
  if (!actor || actor.kind !== "TENANT") redirect("/tenant/login");
  const v = await tenantBillingView(actor);
  if (!v.enabled) redirect("/tenant/pay");
  const b = v.balance;
  const vecoMonths = Array.from({ length: 6 }, (_, i) => addMonths(monthOf(v.today), -i)).map((m) => ({ value: m, label: formatMonth(m) }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-th-ink">Bills</h1>
        <p className="text-sm text-th-muted">{v.tenant.propertyName} · Room {v.tenant.unitNumber}</p>
      </div>

      <div className="rounded-xl border border-th-line bg-th-surface p-5">
        <p className="text-xs text-th-faint">{b.netBalanceCentavos < 0 ? "Credit on your account" : "Balance due"}</p>
        <p className="text-3xl font-bold text-th-ink"><Money c={Math.abs(b.netBalanceCentavos)} /></p>
        {b.overdueCentavos > 0 && <p className="mt-1 text-sm text-th-danger"><Money c={b.overdueCentavos} /> is past due</p>}
        <p className="mt-2 text-xs text-th-faint">Only verified payments reduce your balance. Payments waiting for review are listed below.</p>
      </div>

      {v.missingVecoMonths.length > 0 && (
        <a href="#veco" className="block rounded-xl border border-th-due/40 bg-th-due-soft p-4 text-sm text-th-due">
          Please upload your VECO receipt for {v.missingVecoMonths.map(formatMonth).join(", ")}.
        </a>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-th-ink">Statements</h2>
        {v.statements.length === 0 && <p className="text-sm text-th-muted">No statements yet.</p>}
        {v.statements.map((s) => (
          <Link key={s.id} href={`/tenant/billing/statements/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-th-line bg-th-surface px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-th-ink">{formatDateOnly(s.cycleDate)} statement</p>
              <p className="text-xs text-th-faint">{s.number} · due {formatDateOnly(s.dueDate)}</p>
            </div>
            <div className="text-right">
              {s.totalDueCentavos != null && <p className="text-sm text-th-ink"><Money c={s.totalDueCentavos} /></p>}
              <Pill status={s.status} />
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-th-ink">Send a payment</h2>
        {(v.paymentInstructions || v.account?.gcashNumber || v.account?.mayaNumber || v.account?.bankDetails) && (
          <div className="rounded-xl border border-th-line bg-th-surface p-4 text-sm">
            <p className="text-xs font-semibold text-th-muted">How to pay</p>
            {v.paymentInstructions && <p className="whitespace-pre-line text-th-ink">{v.paymentInstructions}</p>}
            {!v.paymentInstructions && v.account?.gcashNumber && <p className="text-th-ink">GCash {v.account.gcashNumber}</p>}
            {!v.paymentInstructions && v.account?.mayaNumber && <p className="text-th-ink">Maya {v.account.mayaNumber}</p>}
            {!v.paymentInstructions && v.account?.bankDetails && <p className="text-th-ink">{v.account.bankDetails}</p>}
          </div>
        )}
        <PaymentProofForm suggestedCentavos={Math.max(0, b.netBalanceCentavos)} today={v.today} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-th-ink">Your payments</h2>
        {v.payments.length === 0 && <p className="text-sm text-th-muted">No payments submitted yet.</p>}
        {v.payments.map((p) => (
          <div key={p.id} className="rounded-lg border border-th-line bg-th-surface px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-th-ink"><Money c={p.amountCentavos} className="font-medium" /> · {METHOD[p.method] ?? p.method} · {formatDateOnly(p.paidOn)}</span>
              <Pill status={p.status} />
            </div>
            {p.status === "APPROVED" && (
              <div className="mt-1 text-xs text-th-muted">
                {p.receiptNumber && <>Receipt {p.receiptNumber} · </>}
                {p.allocations.length > 0 ? <>applied to {p.allocations.map((a) => a.description).join(", ")}</> : "held as credit"}
                {p.amountCentavos > p.allocatedCentavos && p.allocations.length > 0 && <> · <Money c={p.amountCentavos - p.allocatedCentavos} /> credit</>}
              </div>
            )}
            {p.status === "PENDING" && <p className="mt-1 text-xs text-th-muted">Waiting for the office to verify.</p>}
            {p.status === "REJECTED" && <p className="mt-1 text-xs text-th-danger">Not accepted: {p.rejectedReason}</p>}
            {p.status === "REVERSED" && <p className="mt-1 text-xs text-th-danger">Reversed: {p.reversalReason}</p>}
            <div className="mt-1"><FileLink id={p.proofFileId} label="Your proof" /></div>
          </div>
        ))}
      </section>

      {v.vecoEnabled && (
        <section id="veco" className="space-y-2">
          <h2 className="text-sm font-semibold text-th-ink">VECO electricity receipts</h2>
          <p className="text-xs text-th-muted">You pay VECO directly{v.vecoAccountNumber ? ` (account ${v.vecoAccountNumber})` : ""}. Upload each month&apos;s receipt here — it doesn&apos;t change your rent balance.</p>
          <VecoReceiptForm months={vecoMonths} defaultMonth={v.missingVecoMonths[0] ?? vecoMonths[1]?.value ?? vecoMonths[0].value} />
          {v.veco.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-th-line bg-th-surface px-4 py-3 text-sm">
              <span className="text-th-ink">{formatMonth(r.billingMonth)}{r.amountCentavos != null && <> · <Money c={r.amountCentavos} /></>}</span>
              <span className="flex items-center gap-2"><Pill status={r.status} /><FileLink id={r.fileId} label="View" /></span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
