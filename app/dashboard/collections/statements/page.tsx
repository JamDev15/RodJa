import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { Money, Pill, Section, SubNav } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { addMonths, cycleSchedule, cyclesForMonth, formatDateOnly, formatMonth, monthOf, parsePeriodKey, todayIn } from "@/lib/collections/calendar";
import { loadTenantLedger } from "@/lib/collections/ledger";
import { adminPageContext } from "@/lib/collections/page-context";
import { getProfile, scheduleOf } from "@/lib/collections/profile";
import { settlementStatus } from "@/lib/collections/statement-math";
import { fromDbDate } from "@/lib/collections/calendar";
import { prisma } from "@/lib/prisma";

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; period?: string }> }) {
  const sp = await searchParams;
  const { properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) redirect("/dashboard/collections");
  const profile = await getProfile(propertyId);
  if (!profile) redirect(`/dashboard/collections?propertyId=${propertyId}`);
  const schedule = scheduleOf(profile);
  const today = todayIn(profile.timezone);
  const month = monthOf(today);
  const options = [addMonths(month, -2), addMonths(month, -1), month, addMonths(month, 1)].flatMap((m) => cyclesForMonth(schedule, m).map((c) => cycleSchedule(schedule, c.periodKey)!));
  const upcoming = options.find((o) => o.cycleDate >= today) ?? options[options.length - 1];
  const periodKey = sp.period && parsePeriodKey(sp.period) ? sp.period : upcoming.periodKey;
  const s = cycleSchedule(schedule, periodKey);

  const statements = await prisma.statement.findMany({
    where: { propertyId, periodKey },
    include: { tenant: { select: { name: true, unit: { select: { unitNumber: true } } } }, charges: { select: { amountCentavos: true, status: true } } },
    orderBy: { tenant: { unit: { unitNumber: "asc" } } },
  });
  const drafts = statements.filter((st) => st.status === "DRAFT");
  const rows = await Promise.all(
    statements.map(async (st) => {
      if (st.status !== "PUBLISHED") return { st, status: "DRAFT" as string, outstanding: null as number | null };
      const ledger = await loadTenantLedger(prisma, st.tenantId, today);
      const lines = ledger.charges.filter((c) => c.statementId === st.id);
      return { st, status: settlementStatus(lines, fromDbDate(st.dueDate), today) as string, outstanding: lines.reduce((a, c) => a + c.outstandingCentavos, 0) };
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Statements</h1>
          <p className="text-sm text-th-muted">One statement per occupied room per cycle. Drafts are private until you issue them.</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <SubNav propertyId={propertyId} active="statements" />

      <form className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="propertyId" value={propertyId} />
        <select name="period" defaultValue={periodKey} aria-label="Billing cycle" className="min-w-0 rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink">
          {options.map((o) => (
            <option key={o.periodKey} value={o.periodKey}>
              {formatDateOnly(o.cycleDate)} cycle ({formatMonth(o.month)})
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-th-brand px-4 py-2 text-sm text-th-on-brand hover:bg-th-brand-hover">Show</button>
      </form>

      {s && (
        <div className="grid gap-3 rounded-xl border border-th-line bg-th-surface p-4 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-th-muted">Cycle date</p><p className="font-medium text-th-ink">{formatDateOnly(s.cycleDate)}</p></div>
          <div><p className="text-xs text-th-muted">Service period</p><p className="font-medium text-th-ink">{formatDateOnly(s.periodStart)} – {formatDateOnly(s.periodEnd)}</p></div>
          <div><p className="text-xs text-th-muted">Email on / after</p><p className="font-medium text-th-ink">{formatDateOnly(s.distributeOn)}</p></div>
          <div><p className="text-xs text-th-muted">Payment due</p><p className="font-medium text-th-ink">{formatDateOnly(s.dueDate)}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <ActionForm url="/api/collections/statements/generate" body={{ propertyId, periodKey }} submitLabel={statements.length ? "Refresh drafts" : "Prepare drafts"} variant="default" size="default" successMessage="Drafts are ready to review" />
        {drafts.length > 0 && (
          <ActionForm url="/api/collections/statements/publish" body={{ propertyId, periodKey }} submitLabel={`Issue all ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`} variant="success" size="default" successMessage="Statements issued" />
        )}
      </div>
      <p className="text-xs text-th-faint">Preparing drafts again only adds anything missing — it never duplicates a charge. Issued statements are never changed.</p>

      <Section title={`${statements.length} statement${statements.length === 1 ? "" : "s"}`}>
        <div className="overflow-x-auto rounded-xl border border-th-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface text-left text-th-muted">
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">This cycle</th>
                <th className="px-4 py-3 text-right font-medium">Total due (issued)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ st, status }) => (
                <tr key={st.id} className="border-b border-th-line last:border-0">
                  <td className="px-4 py-3 text-th-ink">{st.tenant.unit.unitNumber}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/collections/statements/${st.id}`} className="text-th-accent hover:underline">{st.tenant.name}</Link>
                    {st.number && <span className="ml-2 text-xs text-th-faint">{st.number}</span>}
                  </td>
                  <td className="px-4 py-3"><Pill status={status} /></td>
                  <td className="px-4 py-3 text-right"><Money c={st.charges.reduce((a, c) => a + c.amountCentavos, 0)} /></td>
                  <td className="px-4 py-3 text-right">{st.totalDueCentavos != null ? <Money c={st.totalDueCentavos} /> : <span className="text-th-faint">—</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-th-muted">No statements for this cycle yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
