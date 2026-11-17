import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Stat } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { EXPENSE_CATEGORIES } from "@/lib/finance/common";
import { pettyCashView } from "@/lib/finance/pettycash";
import { today } from "@/lib/operations/common";

const KIND: Record<string, string> = { TOP_UP: "Top-up", DISBURSEMENT: "Spent", COUNT_ADJUSTMENT: "Count difference", REVERSAL: "Undo" };

export default async function PettyCashPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const v = await pettyCashView(actor, propertyId);
  const day = today();
  const catOptions = Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Petty cash</h1>
          <p className="text-sm text-th-muted">Cash kept on hand for small expenses</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="petty-cash" />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Cash that should be in the box" value={<Money c={v.balanceCentavos} />} hint="Top-ups minus spending and count differences" />
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <ActionForm
          url="/api/operations/petty-cash"
          body={{ action: "top_up", propertyId }}
          toggleLabel="Top up"
          submitLabel="Add cash"
          successMessage="Top-up recorded"
          fields={[
            { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
            { name: "occurredOn", label: "Date", type: "date", required: true, defaultValue: day },
            { name: "description", label: "Note", type: "text", placeholder: "e.g. Withdrawn from bank" },
            { name: "reference", label: "Reference", type: "text" },
          ]}
        />
        <UploadForm
          url="/api/operations/petty-cash"
          hidden={{ propertyId }}
          toggleLabel="Spend"
          submitLabel="Record spending"
          successMessage="Recorded — it's also listed under Expenses"
          fileLabel="Receipt"
          fileRequired={false}
          fields={[
            { name: "description", label: "What was bought", required: true },
            { name: "amount", label: "Amount (₱)", type: "pesos", required: true },
            { name: "category", label: "Category", type: "select", options: catOptions, defaultValue: "SUPPLIES" },
            { name: "incurredOn", label: "Date", type: "date", required: true, defaultValue: day },
            { name: "vendor", label: "Where / who" },
            { name: "reference", label: "Receipt no." },
          ]}
        />
        <ActionForm
          url="/api/operations/petty-cash"
          body={{ action: "count", propertyId }}
          toggleLabel="Record a cash count"
          submitLabel="Save count"
          successMessage="Count recorded"
          fields={[
            { name: "countedCentavos", label: "Cash counted (₱)", type: "pesos", required: true, hint: "Any difference from the recorded balance is saved as a shortage or overage" },
            { name: "occurredOn", label: "Date", type: "date", required: true, defaultValue: day },
            { name: "reason", label: "Explanation", type: "text", required: true },
          ]}
        />
      </div>

      {v.rows.length === 0 ? (
        <Empty>No petty cash entries yet. Start with a top-up.</Empty>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {v.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="text-th-ink">
                  <span className="font-medium">{KIND[r.kind] ?? r.kind}</span>
                  {r.description !== (KIND[r.kind] ?? r.kind) ? ` · ${r.description}` : ""}
                </p>
                <p className="text-xs text-th-muted">
                  {formatDateOnly(fromDbDate(r.occurredOn))}
                  {r.reference ? ` · Ref ${r.reference}` : ""}
                  {v.reversed.has(r.id) ? " · undone" : ""}
                </p>
              </div>
              <span className="flex items-center gap-2">
                {r.receiptFileId && <FileLink id={r.receiptFileId} label="Receipt" />}
                <Money c={r.amountCentavos} className={r.amountCentavos < 0 ? "text-th-muted" : "font-medium"} />
                {r.kind !== "REVERSAL" && !v.reversed.has(r.id) && (
                  <ActionForm url={`/api/operations/petty-cash/${r.id}`} body={{ action: "reverse" }} toggleLabel="Undo" submitLabel="Undo entry" variant="destructive" successMessage="Undone" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
