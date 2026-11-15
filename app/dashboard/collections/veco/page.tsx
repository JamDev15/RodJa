import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Pill, Section, SubNav } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { formatMonth } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { getProfile } from "@/lib/collections/profile";
import { missingVecoReceipts } from "@/lib/collections/veco";
import { prisma } from "@/lib/prisma";

export default async function VecoPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) redirect("/dashboard/collections");
  const profile = await getProfile(propertyId);
  if (!profile) redirect(`/dashboard/collections?propertyId=${propertyId}`);
  const [receipts, missing] = await Promise.all([
    prisma.vecoReceipt.findMany({ where: { propertyId }, include: { tenant: { select: { name: true, unit: { select: { unitNumber: true } } } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 }),
    missingVecoReceipts(propertyId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">VECO receipts</h1>
          <p className="text-sm text-th-muted">Tenants pay VECO directly. These receipts are proof only — they never count as rent collections or income.</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <SubNav propertyId={propertyId} active="veco" />
      {!profile.vecoEnabled && <p className="rounded-lg border border-th-due/30 bg-th-due-soft p-3 text-sm text-th-due">VECO tracking is off. Turn it on in Setup.</p>}

      <Section title="Missing receipts">
        <ul className="space-y-2 text-sm">
          {missing.length === 0 && <li className="text-th-muted">Everyone is up to date.</li>}
          {missing.map((m) => (
            <li key={m.tenantId} className="rounded-lg border border-th-line bg-th-surface px-3 py-2">
              <Link href={`/dashboard/collections/tenants/${m.tenantId}`} className="text-th-accent hover:underline">{m.tenantName}</Link> · Room {m.unitNumber}
              {m.vecoAccountNumber ? ` · VECO ${m.vecoAccountNumber}` : ""} — missing {m.months.map(formatMonth).join(", ")}
              {!m.email && <span className="text-xs text-th-faint"> (no email on file — remind them in person)</span>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-th-faint">Tenants with an email get one reminder per missing month automatically; everyone sees a reminder in their portal.</p>
      </Section>

      <Section title="Uploaded receipts">
        <div className="space-y-2">
          {receipts.length === 0 && <p className="text-sm text-th-muted">None yet.</p>}
          {receipts.map((r) => (
            <div key={r.id} className="rounded-xl border border-th-line bg-th-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-th-ink">
                  {r.tenant.name} · Room {r.tenant.unit.unitNumber} · {formatMonth(r.billingMonth)}
                  {r.amountCentavos != null && <> · <Money c={r.amountCentavos} /></>}
                </span>
                <span className="flex items-center gap-2"><Pill status={r.status} /><FileLink id={r.fileId} label="View receipt" /></span>
              </div>
              {r.rejectedReason && <p className="mt-1 text-xs text-th-danger">{r.rejectedReason}</p>}
              {r.status === "PENDING" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm url={`/api/collections/veco/${r.id}`} body={{ decision: "VERIFY" }} submitLabel="Verify" variant="success" successMessage="Verified" />
                  <ActionForm url={`/api/collections/veco/${r.id}`} body={{ decision: "REJECT" }} toggleLabel="Reject" fields={[{ name: "reason", label: "Reason (tenant sees this)", type: "text", required: true }]} submitLabel="Reject" variant="destructive" successMessage="Rejected" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
