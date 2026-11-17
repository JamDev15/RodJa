import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Section } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { formatDateOnly, fromDbDate, monthOf } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { listMasterReadings, listUtilityBills, SCOPES, UTILITIES } from "@/lib/finance/utilities";
import { today } from "@/lib/operations/common";

export default async function UtilitiesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const [bills, readings] = await Promise.all([listUtilityBills(actor, propertyId), listMasterReadings(actor, propertyId, 30)]);
  const day = today();
  const latestActive = new Map<string, string>();
  for (const r of readings) {
    const k = `${r.utility}|${r.meterLabel}`;
    if (r.status === "ACTIVE" && !latestActive.has(k)) latestActive.set(k, r.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Utilities</h1>
          <p className="text-sm text-th-muted">The building&apos;s own water and common-area electricity</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="utilities" />

      <Section
        title="Bills"
        action={
          <UploadForm
            url="/api/operations/utility-bills"
            hidden={{ propertyId }}
            toggleLabel="Record a bill"
            submitLabel="Save bill"
            successMessage="Bill recorded"
            fileLabel="Bill (photo or PDF)"
            fileRequired={false}
            fields={[
              { name: "utility", label: "Utility", type: "select", options: [{ value: "WATER", label: "Water" }, { value: "ELECTRICITY", label: "Electricity (VECO)" }] },
              { name: "scope", label: "Covers", type: "select", options: [{ value: "MASTER", label: "Master — whole building" }, { value: "COMMON_AREA", label: "Common areas" }] },
              { name: "billingMonth", label: "Bill month", type: "month", required: true, defaultValue: monthOf(day) },
              { name: "amount", label: "Amount due (₱)", type: "pesos", required: true },
              { name: "consumption", label: "Consumption (m³ or kWh)" },
              { name: "dueDate", label: "Due date", type: "date" },
              { name: "accountNumber", label: "Account no." },
            ]}
          />
        }
      >
        {bills.length === 0 ? (
          <Empty>No bills recorded yet.</Empty>
        ) : (
          <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
            {bills.map((b) => (
              <li key={b.id} className={`space-y-1 p-3 text-sm ${b.status === "VOID" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-th-ink">
                      {UTILITIES[b.utility as keyof typeof UTILITIES]} · {b.billingMonth} · {SCOPES[b.scope as keyof typeof SCOPES]}
                    </p>
                    <p className="text-xs text-th-muted">
                      {b.consumption ? `${b.consumption.toString()} ${b.consumptionUnit} · ` : ""}
                      {b.dueDate ? `due ${formatDateOnly(fromDbDate(b.dueDate))} · ` : ""}
                      <span className={b.status === "PAID" ? "text-th-paid" : b.status === "VOID" ? "text-th-danger" : "text-th-due"}>{b.status === "PAID" ? "Paid" : b.status === "VOID" ? `Voided: ${b.voidReason}` : "Unpaid"}</span>
                    </p>
                  </div>
                  <Money c={b.amountCentavos} className="font-semibold" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FileLink id={b.billFileId} label="Bill" />
                  {b.status === "UNPAID" && (
                    <>
                      <ActionForm
                        url={`/api/operations/utility-bills/${b.id}`}
                        body={{ action: "pay" }}
                        toggleLabel="Mark paid"
                        submitLabel="Record payment"
                        variant="success"
                        successMessage="Paid — recorded as an expense"
                        fields={[
                          { name: "paidOn", label: "Date paid", type: "date", required: true, defaultValue: day },
                          { name: "method", label: "Paid with", type: "select", options: [{ value: "cash", label: "Cash" }, { value: "gcash", label: "GCash" }, { value: "maya", label: "Maya" }, { value: "bank", label: "Bank transfer" }, { value: "check", label: "Check" }, { value: "other", label: "Other" }] },
                          { name: "referenceNumber", label: "Reference", type: "text" },
                        ]}
                      />
                      <ActionForm
                        url={`/api/operations/utility-bills/${b.id}`}
                        body={{ action: "update" }}
                        toggleLabel="Correct"
                        submitLabel="Save"
                        fields={[
                          { name: "amountCentavos", label: "Amount (₱)", type: "pesos", defaultValue: (b.amountCentavos / 100).toFixed(2) },
                          { name: "consumption", label: "Consumption", type: "text", defaultValue: b.consumption?.toString() ?? "" },
                          { name: "notes", label: "Notes", type: "text", defaultValue: b.notes ?? "" },
                        ]}
                      />
                      {!b.billFileId && <UploadForm url={`/api/operations/utility-bills/${b.id}`} toggleLabel="Add bill scan" fileLabel="Bill" submitLabel="Upload" />}
                      <ActionForm url={`/api/operations/utility-bills/${b.id}`} body={{ action: "void" }} toggleLabel="Void" submitLabel="Void bill" variant="destructive" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
                    </>
                  )}
                  {b.status === "PAID" && <span className="text-xs text-th-muted">To undo the payment, void its expense on the Expenses page.</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Building meter readings"
        action={
          <ActionForm
            url="/api/operations/master-readings"
            body={{ propertyId }}
            toggleLabel="Add a reading"
            submitLabel="Save reading"
            successMessage="Reading saved"
            fields={[
              { name: "utility", label: "Meter", type: "select", options: [{ value: "WATER", label: "Main water meter" }, { value: "ELECTRICITY", label: "Common-area electric meter" }] },
              { name: "meterLabel", label: "Meter name (if more than one)", type: "text", placeholder: "Leave blank for the main meter" },
              { name: "value", label: "Reading", type: "text", required: true },
              { name: "readingDate", label: "Date", type: "date", required: true, defaultValue: day },
              { name: "isMeterReset", label: "Meter was replaced or reset", type: "checkbox" },
            ]}
          />
        }
      >
        <p className="text-xs text-th-faint">Caretakers can also enter these from their phone. Readings must be in date order; only the latest can be voided.</p>
        {readings.length === 0 ? (
          <Empty>No readings yet.</Empty>
        ) : (
          <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface text-sm">
            {readings.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 ${r.status === "VOID" ? "opacity-60" : ""}`}>
                <span className="min-w-0 text-th-ink">
                  {formatDateOnly(fromDbDate(r.readingDate))} · {r.meterLabel} · <strong>{r.value.toString()}</strong>
                  <span className="text-th-muted">
                    {r.usage ? ` · used ${r.usage.toString()} ${r.utility === "WATER" ? "m³" : "kWh"}` : r.isMeterReset ? " · new starting point" : " · first reading"}
                    {r.status === "VOID" ? ` · voided: ${r.voidReason}` : ""}
                  </span>
                </span>
                {latestActive.get(`${r.utility}|${r.meterLabel}`) === r.id && (
                  <ActionForm url={`/api/operations/master-readings/${r.id}`} body={{ action: "void" }} toggleLabel="Void" submitLabel="Void reading" variant="destructive" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
