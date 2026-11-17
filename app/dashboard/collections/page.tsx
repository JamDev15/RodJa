import Link from "next/link";
import { AlertTriangle, Droplets, FileText, Zap } from "lucide-react";
import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Pill, Section, Stat, SubNav, periodLabel } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { addMonths, cyclesForMonth, formatDateOnly, formatMonth } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { scheduleOf } from "@/lib/collections/profile";
import { collectionsOverview } from "@/lib/collections/views";

type Search = { propertyId?: string; month?: string; periodKey?: string; unitId?: string; tenantId?: string; paymentStatus?: string };

const selectClass = "min-w-0 rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink focus:border-th-accent focus:outline-none";

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) {
    return <Empty text="Add a property first, then set up billing for it here." />;
  }
  const data = await collectionsOverview(actor, propertyId, sp);
  if (!data.profile) {
    return (
      <div className="space-y-6">
        <Header properties={properties} propertyId={propertyId} name={data.property.name} />
        <div className="rounded-xl border border-th-line bg-th-surface p-6 space-y-3">
          <h2 className="font-semibold text-th-ink">Statement billing isn&apos;t set up for {data.property.name}</h2>
          <p className="text-sm text-th-muted">
            Twice-monthly statements, verified payments, occupant-based water and VECO receipt tracking. Other properties keep using the monthly ledger as they do now.
          </p>
          <ActionForm url="/api/collections/profile" body={{ propertyId }} submitLabel="Set up billing for this property" successMessage="Billing set up — review the settings next" redirectTo={`/dashboard/collections/settings?propertyId=${propertyId}`} />
        </div>
      </div>
    );
  }

  const t = data.totals;
  const months = [addMonths(data.month, -2), addMonths(data.month, -1), data.month, addMonths(data.month, 1)];
  const cycles = cyclesForMonth(scheduleOf(data.profile), data.month);
  const filterLabel = data.periodKey ? periodLabel(data.periodKey, cycles.find((c) => c.periodKey === data.periodKey)?.cycleDate) : formatMonth(data.month);

  return (
    <div className="space-y-6">
      <Header properties={properties} propertyId={propertyId} name={data.property.name} />
      <SubNav propertyId={propertyId} active="overview" />
      {!data.profile.enabled && (
        <p className="rounded-lg border border-th-due/30 bg-th-due-soft p-3 text-sm text-th-due">Billing is turned off for this property. Turn it on in Setup when you&apos;re ready.</p>
      )}

      <form className="flex flex-wrap gap-2" aria-label="Filters">
        <input type="hidden" name="propertyId" value={propertyId} />
        <select name="month" defaultValue={data.month} className={selectClass} aria-label="Month">
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <select name="periodKey" defaultValue={data.periodKey ?? ""} className={selectClass} aria-label="Billing period">
          <option value="">Whole month</option>
          {cycles.map((c) => (
            <option key={c.periodKey} value={c.periodKey}>{formatDateOnly(c.cycleDate)} cycle</option>
          ))}
        </select>
        <select name="unitId" defaultValue={sp.unitId ?? ""} className={selectClass} aria-label="Room">
          <option value="">All rooms</option>
          {[...new Map(data.rows.map((r) => [r.unitId, r.unitNumber])).entries()].map(([id, n]) => (
            <option key={id} value={id}>Room {n}</option>
          ))}
        </select>
        <select name="tenantId" defaultValue={sp.tenantId ?? ""} className={selectClass} aria-label="Tenant">
          <option value="">All tenants</option>
          {data.rows.map((r) => (
            <option key={r.tenantId} value={r.tenantId}>{r.tenantName}</option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={sp.paymentStatus ?? ""} className={selectClass} aria-label="Payment status">
          <option value="">Payments: pending review</option>
          <option value="APPROVED">Payments: approved</option>
          <option value="REJECTED">Payments: rejected</option>
          <option value="REVERSED">Payments: reversed</option>
        </select>
        <button className="rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">Apply</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Charges issued · ${filterLabel}`} value={<Money c={t.chargesIssuedCentavos} />} hint={t.adjustmentsCentavos ? `Waivers/reductions on these: ${formatAdj(t.adjustmentsCentavos)}` : "Issued statement lines for the period (excludes carried balances)"} />
        <Stat label={`Payments received · ${formatMonth(data.month)}`} value={<Money c={t.paymentsReceivedCentavos} />} hint={`${t.paymentsReceivedCount} approved, by paid-on date. VECO excluded.`} tone="paid" />
        <Stat label={`Outstanding · as of ${formatDateOnly(data.today)}`} value={<Money c={t.outstandingCentavos} />} hint={t.creditCentavos ? `Unapplied credit: ${formatAdj(t.creditCentavos)}` : "All unpaid issued charges"} tone={t.outstandingCentavos ? "due" : undefined} />
        <Stat label="Overdue" value={<Money c={t.overdueCentavos} />} hint={`${t.overdueAccounts} account${t.overdueAccounts === 1 ? "" : "s"} past due`} tone={t.overdueCentavos ? "danger" : undefined} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Alert icon={<FileText className="h-4 w-4" />} n={t.pendingApprovals} label="payments to review" href="#payments" />
        <Alert icon={<FileText className="h-4 w-4" />} n={t.drafts} label="draft statements" href={`/dashboard/collections/statements?propertyId=${propertyId}`} />
        <Alert icon={<Zap className="h-4 w-4" />} n={t.missingVecoTenants + t.pendingVeco} label={`VECO (${t.missingVecoTenants} missing, ${t.pendingVeco} to check)`} href={`/dashboard/collections/veco?propertyId=${propertyId}`} />
        <Alert icon={<Droplets className="h-4 w-4" />} n={t.waterAlerts} label="water usage alerts" href={`/dashboard/collections/water?propertyId=${propertyId}`} />
      </div>

      <Section title={sp.paymentStatus ? `Payments · ${sp.paymentStatus.toLowerCase()}` : "Payments waiting for review"} id="payments">
        {data.payments.length === 0 ? (
          <p className="text-sm text-th-muted">Nothing here.</p>
        ) : (
          <div className="space-y-3">
            {data.payments.map((p) => (
              <div key={p.id} className="rounded-xl border border-th-line bg-th-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-th-ink">
                      <Money c={p.amountCentavos} /> <span className="font-normal text-th-muted">· {p.method.toUpperCase()}</span>
                    </p>
                    <p className="text-sm text-th-muted">
                      <Link href={`/dashboard/collections/tenants/${p.tenantId}`} className="text-th-accent hover:underline">{p.tenantName}</Link> · Room {p.unitNumber} · paid {formatDateOnly(p.paidOn)}
                      {p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}
                    </p>
                    {p.rejectedReason && <p className="text-xs text-th-danger">Rejected: {p.rejectedReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill status={p.status} />
                    <FileLink id={p.proofFileId} />
                  </div>
                </div>
                {p.status === "PENDING" && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <ActionForm url={`/api/collections/payments/${p.id}`} body={{ action: "approve" }} submitLabel="Approve" variant="success" successMessage="Payment approved and applied" />
                    <ActionForm
                      url={`/api/collections/payments/${p.id}`}
                      body={{ action: "approve" }}
                      toggleLabel="Approve a different amount"
                      fields={[{ name: "correctedAmountCentavos", label: "Amount actually received (₱)", type: "pesos", required: true }, { name: "note", label: "Note", type: "text" }]}
                      submitLabel="Approve corrected amount"
                      variant="success"
                      successMessage="Payment approved"
                    />
                    <ActionForm
                      url={`/api/collections/payments/${p.id}`}
                      body={{ action: "reject" }}
                      toggleLabel="Reject"
                      fields={[{ name: "reason", label: "Reason (the tenant will see this)", type: "text", required: true }]}
                      submitLabel="Reject payment"
                      variant="destructive"
                      successMessage="Payment rejected"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Accounts">
        <div className="overflow-x-auto rounded-xl border border-th-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface text-left text-th-muted">
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Latest statement</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.tenantId} className="border-b border-th-line last:border-0">
                  <td className="px-4 py-3 text-th-ink">{r.unitNumber}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/collections/tenants/${r.tenantId}`} className="text-th-accent hover:underline">{r.tenantName}</Link>
                    {!r.isActive && <span className="ml-2 text-xs text-th-faint">moved out</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.latestStatement ? (
                      <Link href={`/dashboard/collections/statements/${r.latestStatement.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <span className="text-th-muted">{r.latestStatement.number}</span>
                        <Pill status={r.latestStatement.status} />
                      </Link>
                    ) : (
                      <span className="text-th-faint">None issued</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right"><Money c={r.outstandingCentavos} className={r.outstandingCentavos ? "text-th-ink" : "text-th-faint"} /></td>
                  <td className="px-4 py-3 text-right"><Money c={r.overdueCentavos} className={r.overdueCentavos ? "font-semibold text-th-danger" : "text-th-faint"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {data.waterAlerts.length > 0 && (
        <Section title="Water usage over allowance">
          <ul className="space-y-2 text-sm">
            {data.waterAlerts.map((w) => (
              <li key={w.readingId} className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-th-due" /> Room {w.unitNumber}: {w.usage} used ({formatDateOnly(w.readingDate)}) {w.proposal && <Pill status={w.proposal.status} />}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function formatAdj(c: number) {
  return `${c < 0 ? "−" : ""}₱${(Math.abs(c) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function Header({ properties, propertyId, name }: { properties: { id: string; name: string }[]; propertyId: string; name: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-th-ink">Collections</h1>
        <p className="text-sm text-th-muted">{name} · statements, payments and receipts</p>
      </div>
      <PropertyPicker properties={properties} value={propertyId} />
    </div>
  );
}

function Alert({ icon, n, label, href }: { icon: React.ReactNode; n: number; label: string; href: string }) {
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${n ? "border-th-due/40 bg-th-due-soft text-th-due" : "border-th-line bg-th-surface text-th-muted"}`}>
      {icon}
      <span><strong className="text-base">{n}</strong> {label}</span>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-th-line bg-th-surface p-6 text-sm text-th-muted">{text}</p>;
}
