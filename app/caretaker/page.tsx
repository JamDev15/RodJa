import Link from "next/link";
import { redirect } from "next/navigation";
import { MeterEntry } from "@/components/collections/meter-entry";
import { caretakerPropertyIds, currentActor } from "@/lib/collections/actor";
import { todayIn } from "@/lib/collections/calendar";
import { meterEntryView } from "@/lib/collections/meters";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/collections/action-form";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";

export default async function CaretakerPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const ids = actor.kind === "CARETAKER" ? await caretakerPropertyIds(actor) : (await prisma.property.findMany({ where: { accountId: actor.accountId }, select: { id: true } })).map((p) => p.id);
  const properties = await prisma.property.findMany({ where: { id: { in: ids }, billingProfile: { enabled: true } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (properties.length === 0) {
    return <p className="rounded-xl border border-th-line bg-th-surface p-6 text-sm text-th-muted">No properties are assigned to you yet. Ask the office to add you.</p>;
  }
  const property = properties.find((p) => p.id === sp.propertyId) ?? properties[0];
  const view = await meterEntryView(actor, property.id);
  return (
    <div className="space-y-4">
      {properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <Link key={p.id} href={`/caretaker?propertyId=${p.id}`} className={`rounded-lg px-3 py-1.5 text-sm ${p.id === property.id ? "bg-th-brand text-th-on-brand" : "bg-th-surface text-th-muted"}`}>{p.name}</Link>
          ))}
        </div>
      )}
      <h1 className="text-xl font-bold text-th-ink">{property.name}</h1>
      <MeterEntry view={view} today={todayIn("Asia/Manila")} />
      <BuildingMeters propertyId={property.id} />
    </div>
  );
}

/** Main water / common-area electric meter readings for the building. */
async function BuildingMeters({ propertyId }: { propertyId: string }) {
  const recent = await prisma.masterMeterReading.findMany({ where: { propertyId, status: "ACTIVE" }, orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }], take: 4 });
  return (
    <section className="space-y-2 rounded-xl border border-th-line bg-th-surface p-4">
      <h2 className="font-semibold text-th-ink">Building meters</h2>
      {recent.length > 0 && (
        <ul className="space-y-0.5 text-xs text-th-muted">
          {recent.map((r) => (
            <li key={r.id}>{r.meterLabel}: {r.value.toString()} on {formatDateOnly(fromDbDate(r.readingDate))}</li>
          ))}
        </ul>
      )}
      <ActionForm
        url="/api/caretaker/master-readings"
        body={{ propertyId }}
        toggleLabel="Enter a building meter reading"
        submitLabel="Save reading"
        successMessage="Reading saved"
        fields={[
          { name: "utility", label: "Meter", type: "select", options: [{ value: "WATER", label: "Main water meter" }, { value: "ELECTRICITY", label: "Common-area electric meter" }] },
          { name: "value", label: "Reading", type: "text", required: true },
          { name: "readingDate", label: "Date", type: "date", required: true, defaultValue: todayIn("Asia/Manila") },
          { name: "isMeterReset", label: "Meter was replaced or reset", type: "checkbox" },
        ]}
      />
    </section>
  );
}
