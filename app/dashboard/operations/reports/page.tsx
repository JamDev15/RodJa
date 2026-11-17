import { Money } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { isValidMonth } from "@/lib/collections/calendar";
import { BillingError } from "@/lib/collections/errors";
import { adminPageContext } from "@/lib/collections/page-context";
import { defaultRange, parseReportName, REPORTS, runReport, type ReportColumn, type ReportName, type Row } from "@/lib/finance/reports";

function Cell({ c, v }: { c: ReportColumn; v: Row[string] | undefined }) {
  if (v == null || v === "") return <>—</>;
  if (c.kind === "money") return <Money c={v as number} />;
  if (c.kind === "percent") return <>{v}%</>;
  return <>{String(v)}</>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; report?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  let name: ReportName = "income";
  try {
    name = parseReportName(sp.report ?? "income");
  } catch {
    name = "income";
  }
  const def = defaultRange();
  const from = sp.from && isValidMonth(sp.from) ? sp.from : def.from;
  const to = sp.to && isValidMonth(sp.to) ? sp.to : def.to;
  const noRange = name === "receivables" || name === "deposits";
  let table = null;
  let error: string | null = null;
  try {
    table = await runReport(actor, name, { propertyId, from, to });
  } catch (e) {
    if (e instanceof BillingError) error = e.message;
    else throw e;
  }
  const csv = `/api/operations/reports/${name}?propertyId=${propertyId}&from=${from}&to=${to}&format=csv`;
  const inputClass = "rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base text-th-ink sm:text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Reports</h1>
          <p className="text-sm text-th-muted">Income, collections, receivables, utilities, expenses, cash flow, occupancy and deposits</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="reports" />

      <form action="" className="flex flex-wrap items-end gap-2 text-sm">
        <input type="hidden" name="propertyId" value={propertyId} />
        <label className="space-y-1 text-xs text-th-muted">
          <span className="block">Report</span>
          <select name="report" defaultValue={name} className={inputClass}>
            {Object.entries(REPORTS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-th-muted">
          <span className="block">From</span>
          <input type="month" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs text-th-muted">
          <span className="block">To</span>
          <input type="month" name="to" defaultValue={to} className={inputClass} />
        </label>
        <button className="rounded-lg bg-th-brand px-4 py-2 font-medium text-th-on-brand">Show</button>
        {table && (
          <a href={csv} className="rounded-lg border border-th-line px-4 py-2 font-medium text-th-ink hover:bg-th-raised">Download CSV</a>
        )}
      </form>
      {noRange && <p className="text-xs text-th-faint">This report is as of today; the month range doesn&apos;t apply.</p>}

      {error && <p className="rounded-lg border border-th-danger/30 bg-th-danger-soft p-3 text-sm text-th-danger">{error}</p>}
      {table && (
        <section className="space-y-3">
          <h2 className="font-semibold text-th-ink">{table.title}</h2>
          {table.rows.length === 0 ? (
            <Empty>Nothing to show for this period.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-th-line bg-th-surface">
              <table className="min-w-full text-sm">
                <thead className="bg-th-raised text-xs text-th-muted">
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${c.kind === "text" ? "text-left" : "text-right"}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-th-line">
                  {table.rows.map((r, i) => (
                    <tr key={i}>
                      {table.columns.map((c) => (
                        <td key={c.key} className={`whitespace-nowrap px-3 py-2 text-th-ink ${c.kind === "text" ? "text-left" : "text-right tabular-nums"}`}><Cell c={c} v={r[c.key]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {table.totals && (
                  <tfoot className="border-t-2 border-th-line font-semibold">
                    <tr>
                      {table.columns.map((c) => (
                        <td key={c.key} className={`whitespace-nowrap px-3 py-2 text-th-ink ${c.kind === "text" ? "text-left" : "text-right tabular-nums"}`}><Cell c={c} v={table.totals![c.key]} /></td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-th-muted">
            {table.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
