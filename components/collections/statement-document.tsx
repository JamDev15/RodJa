import { CHARGE_LABELS, type ChargeType } from "@/lib/collections/plan";
import { formatDateOnly } from "@/lib/collections/calendar";
import type { statementDetail } from "@/lib/collections/views";
import { Money } from "./bits";

type Detail = Awaited<ReturnType<typeof statementDetail>>;
type Snapshot = {
  number: string;
  property: { name: string; address: string; logoFileId: string | null };
  tenant: { name: string; room: string };
  lines: { chargeId: string; type: string; description: string; amountCentavos: number }[];
  totals: { previousBalanceCentavos: number; currentChargesCentavos: number; penaltiesCentavos: number; adjustmentsCentavos: number; appliedToThisStatementCentavos: number; unappliedCreditCentavos: number; totalDueCentavos: number };
  paymentInstructions: string | null;
  issuedAt: string;
};

/**
 * The statement as issued (from its frozen snapshot), followed by anything
 * that changed afterwards. Drafts render live lines with a DRAFT mark.
 */
export function StatementDocument({ d }: { d: Detail }) {
  const snap = d.statement.snapshot as Snapshot | null;
  const lines = snap?.lines ?? d.lines.map((l) => ({ chargeId: l.id, type: l.type, description: l.description, amountCentavos: l.amountCentavos }));
  const current = lines.filter((l) => l.type !== "PENALTY");
  const penalties = lines.filter((l) => l.type === "PENALTY");
  const t = snap?.totals;
  const draft = d.statement.status === "DRAFT";
  return (
    <article className="rounded-xl border border-th-line bg-th-surface p-5 text-sm text-th-ink sm:p-8 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-th-line pb-4">
        <div className="flex items-center gap-3">
          {d.profile?.logoFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${d.profile.logoFileId}`} alt="" className="h-12 w-12 rounded object-contain" />
          )}
          <div>
            <p className="text-lg font-bold">{snap?.property.name ?? d.property.name}</p>
            <p className="text-xs text-th-muted">{snap?.property.address ?? d.property.address}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-th-muted">Statement of account</p>
          <p className="font-semibold">{draft ? "DRAFT — not issued" : snap?.number ?? d.statement.number}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 border-b border-th-line py-4 sm:grid-cols-4">
        <div><dt className="text-xs text-th-muted">Tenant</dt><dd className="font-medium">{snap?.tenant.name ?? d.tenant.name}</dd></div>
        <div><dt className="text-xs text-th-muted">Room</dt><dd className="font-medium">{snap?.tenant.room ?? d.unit.unitNumber}</dd></div>
        <div><dt className="text-xs text-th-muted">Billing period</dt><dd className="font-medium">{formatDateOnly(d.statement.periodStart)} – {formatDateOnly(d.statement.periodEnd)}</dd></div>
        <div><dt className="text-xs text-th-muted">Due date</dt><dd className="font-semibold">{formatDateOnly(d.statement.dueDate)}</dd></div>
      </dl>

      <table className="mt-4 w-full">
        <thead>
          <tr className="text-left text-xs text-th-muted"><th className="pb-2 font-medium">Current charges</th><th className="pb-2 text-right font-medium">Amount</th></tr>
        </thead>
        <tbody>
          {current.map((l) => (
            <tr key={l.chargeId}>
              <td className="py-1">{l.description}{l.description !== CHARGE_LABELS[l.type as ChargeType] && <span className="ml-2 text-xs text-th-faint">{CHARGE_LABELS[l.type as ChargeType]}</span>}</td>
              <td className="py-1 text-right"><Money c={l.amountCentavos} /></td>
            </tr>
          ))}
          <tr className="border-t border-th-line font-medium"><td className="py-2">Current charges subtotal</td><td className="py-2 text-right"><Money c={current.reduce((a, l) => a + l.amountCentavos, 0)} /></td></tr>
          {draft ? (
            <tr><td colSpan={2} className="py-2 text-xs text-th-muted">Previous balance, credits and the total due are calculated when the statement is issued.</td></tr>
          ) : t ? (
            <>
              <tr><td className="py-1">Previous outstanding balance</td><td className="py-1 text-right"><Money c={t.previousBalanceCentavos} /></td></tr>
              {penalties.map((l) => (
                <tr key={l.chargeId}><td className="py-1">{l.description}</td><td className="py-1 text-right"><Money c={l.amountCentavos} /></td></tr>
              ))}
              {t.adjustmentsCentavos !== 0 && <tr><td className="py-1">Adjustments</td><td className="py-1 text-right"><Money c={t.adjustmentsCentavos} /></td></tr>}
              {t.appliedToThisStatementCentavos > 0 && <tr><td className="py-1">Payments/credits already applied to these charges</td><td className="py-1 text-right"><Money c={-t.appliedToThisStatementCentavos} /></td></tr>}
              {t.unappliedCreditCentavos > 0 && <tr><td className="py-1">Unapplied credit</td><td className="py-1 text-right"><Money c={-t.unappliedCreditCentavos} /></td></tr>}
              <tr className="border-t-2 border-th-ink text-base font-bold">
                <td className="py-2">{t.totalDueCentavos < 0 ? "Credit balance" : "Total due"}</td>
                <td className="py-2 text-right"><Money c={Math.abs(t.totalDueCentavos)} /></td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>

      {(snap?.paymentInstructions ?? d.profile?.paymentInstructions) && (
        <div className="mt-4 rounded-lg bg-th-raised p-3">
          <p className="text-xs font-semibold text-th-muted">How to pay</p>
          <p className="whitespace-pre-line">{snap?.paymentInstructions ?? d.profile?.paymentInstructions}</p>
        </div>
      )}

      {d.changesSinceIssue.length > 0 && (
        <div className="mt-4 border-t border-th-line pt-3">
          <p className="text-xs font-semibold text-th-muted">Since this statement was issued</p>
          <ul className="mt-1 space-y-1">
            {d.changesSinceIssue.map((c, i) => (
              <li key={i} className={`flex justify-between gap-3 text-xs ${c.reversed ? "text-th-faint line-through" : ""}`}>
                <span>{formatDateOnly(c.at.slice(0, 10))} · {c.text}</span>
                <Money c={c.amountCentavos} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium">Still unpaid on this statement now: <Money c={d.statement.outstandingNowCentavos} /></p>
        </div>
      )}
      {snap && <p className="mt-4 text-[11px] text-th-faint">Issued {new Date(snap.issuedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>}
    </article>
  );
}
