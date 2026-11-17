import { redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { Money, Pill, Section, SubNav } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { MeterEntry } from "@/components/collections/meter-entry";
import { formatDateOnly, fromDbDate, todayIn } from "@/lib/collections/calendar";
import { meterEntryView } from "@/lib/collections/meters";
import { adminPageContext } from "@/lib/collections/page-context";
import { getProfile } from "@/lib/collections/profile";
import { prisma } from "@/lib/prisma";

export default async function WaterPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) redirect("/dashboard/collections");
  const profile = await getProfile(propertyId);
  if (!profile) redirect(`/dashboard/collections?propertyId=${propertyId}`);
  const view = await meterEntryView(actor, propertyId);
  const [proposals, readings] = await Promise.all([
    prisma.waterExcessProposal.findMany({ where: { propertyId }, include: { reading: { include: { unit: { select: { unitNumber: true } } } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.meterReading.findMany({ where: { propertyId }, include: { unit: { select: { unitNumber: true } } }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }], take: 60 }),
  ]);
  const tenantNames = new Map((await prisma.tenant.findMany({ where: { id: { in: proposals.map((p) => p.tenantId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const ruleSet = profile.meterAllowance != null && profile.meterExcessRateCentavos != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Water meters</h1>
          <p className="text-sm text-th-muted">
            {profile.meterAllowance != null ? <>Allowance {profile.meterAllowance.toString()} {profile.meterUnitLabel} between readings. </> : <>No allowance set yet — usage is recorded but not flagged. </>}
            {ruleSet ? <>Excess billed at <Money c={profile.meterExcessRateCentavos} />/{profile.meterUnitLabel}, only after your approval.</> : <>No excess rate set — nothing will be billed.</>}
          </p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <SubNav propertyId={propertyId} active="water" />

      <Section title="Proposed excess charges">
        <div className="space-y-3">
          {proposals.length === 0 && <p className="text-sm text-th-muted">None.</p>}
          {proposals.map((p) => (
            <div key={p.id} className="rounded-xl border border-th-line bg-th-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-th-ink">
                  Room {p.reading.unit.unitNumber} · {p.tenantId ? tenantNames.get(p.tenantId) : "no tenant on that date"} · used {p.usage.toString()} (allowance {p.allowance.toString()}) → <Money c={p.proposedCentavos} className="font-semibold" />
                </span>
                <span className="flex items-center gap-2">
                  <Pill status={p.status} />
                  {p.chargeId && <span className="text-xs text-th-muted">on a statement</span>}
                </span>
              </div>
              <p className="text-xs text-th-muted">Reading {formatDateOnly(fromDbDate(p.reading.readingDate))}{p.decisionNote ? ` · ${p.decisionNote}` : ""}</p>
              {p.status === "PENDING" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm url={`/api/collections/proposals/${p.id}`} body={{ decision: "APPROVE" }} submitLabel="Approve — add to next statement" variant="success" successMessage="Approved" />
                  <ActionForm url={`/api/collections/proposals/${p.id}`} body={{ decision: "REJECT" }} toggleLabel="Reject" fields={[{ name: "note", label: "Reason", type: "text", required: true }]} submitLabel="Reject" variant="destructive" successMessage="Rejected" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Enter readings">
        <MeterEntry view={view} today={todayIn(profile.timezone)} />
      </Section>

      <Section title="Reading history">
        <div className="overflow-x-auto rounded-xl border border-th-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface text-left text-th-muted">
                <th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Room</th><th className="px-3 py-2 font-medium">Meter</th>
                <th className="px-3 py-2 text-right font-medium">Reading</th><th className="px-3 py-2 text-right font-medium">Usage</th><th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className={`border-b border-th-line last:border-0 ${r.status === "VOID" ? "text-th-faint line-through" : "text-th-ink"}`}>
                  <td className="px-3 py-2">{formatDateOnly(fromDbDate(r.readingDate))}</td>
                  <td className="px-3 py-2">{r.unit.unitNumber}</td>
                  <td className="px-3 py-2">{r.meterId}{r.isMeterReset ? " (new baseline)" : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.value.toString()}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.overAllowance ? "font-semibold text-th-due" : ""}`}>{r.usage?.toString() ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.status === "ACTIVE" && (
                      <ActionForm url={`/api/collections/readings/${r.id}`} toggleLabel="Void" fields={[{ name: "reason", label: "Reason", type: "text", required: true }]} submitLabel="Void reading" variant="outline" successMessage="Reading voided" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
