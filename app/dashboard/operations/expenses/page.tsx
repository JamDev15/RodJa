import Link from "next/link";
import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Stat } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { formatDateOnly, fromDbDate, isValidMonth, monthOf } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { prisma } from "@/lib/prisma";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/finance/common";
import { listExpenses } from "@/lib/finance/expenses";
import { today } from "@/lib/operations/common";

const METHOD_OPTIONS = [
  { value: "", label: "Not paid yet" },
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank transfer" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; month?: string; voided?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const day = today();
  const month = sp.month && isValidMonth(sp.month) ? sp.month : monthOf(day);
  const showVoid = sp.voided === "1";
  const [rows, units] = await Promise.all([
    listExpenses(actor, propertyId, { month, includeVoid: showVoid }),
    prisma.unit.findMany({ where: { propertyId }, select: { id: true, unitNumber: true }, orderBy: { unitNumber: "asc" } }),
  ]);
  const active = rows.filter((r) => r.status === "RECORDED");
  const total = active.reduce((s, r) => s + r.amountCentavos, 0);
  const unpaid = active.filter((r) => !r.paidOn).reduce((s, r) => s + r.amountCentavos, 0);
  const byCat = Object.entries(
    active.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + r.amountCentavos;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const catOptions = Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label }));
  const q = `propertyId=${propertyId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Expenses</h1>
          <p className="text-sm text-th-muted">Operating costs, with receipts kept privately</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="expenses" />

      <form className="flex flex-wrap items-end gap-2 text-sm" action="">
        <input type="hidden" name="propertyId" value={propertyId} />
        <label className="space-y-1 text-xs text-th-muted">
          <span className="block">Month</span>
          <input type="month" name="month" defaultValue={month} className="rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base text-th-ink sm:text-sm" />
        </label>
        <button className="rounded-lg border border-th-line px-3 py-2 text-th-ink hover:bg-th-raised">Show</button>
        <Link href={`?${q}&month=${month}${showVoid ? "" : "&voided=1"}`} className="py-2 text-th-accent hover:underline">{showVoid ? "Hide voided" : "Show voided"}</Link>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={`Expenses in ${month}`} value={<Money c={total} />} hint={`${active.length} entries`} />
        <Stat label="Recorded but not paid" value={<Money c={unpaid} />} tone={unpaid ? "due" : undefined} />
        <div className="col-span-2 rounded-xl border border-th-line bg-th-surface p-4 text-sm lg:col-span-1">
          <p className="mb-1 text-xs text-th-muted">By category</p>
          {byCat.length === 0 ? <p className="text-th-muted">—</p> : byCat.map(([c, v]) => (
            <p key={c} className="flex justify-between gap-2"><span className="truncate text-th-ink">{EXPENSE_CATEGORIES[c as ExpenseCategory] ?? c}</span><Money c={v} /></p>
          ))}
        </div>
      </div>

      <UploadForm
        url="/api/operations/expenses"
        hidden={{ propertyId }}
        toggleLabel="Record an expense"
        submitLabel="Save expense"
        successMessage="Expense recorded"
        fileLabel="Receipt or invoice"
        fileRequired={false}
        fields={[
          { name: "category", label: "Category", type: "select", options: catOptions, defaultValue: "REPAIRS_MAINTENANCE" },
          { name: "description", label: "What was it for", required: true, placeholder: "e.g. Plumber — Room 101 faucet" },
          { name: "amount", label: "Amount (₱)", type: "pesos", required: true },
          { name: "incurredOn", label: "Date", type: "date", required: true, defaultValue: day },
          { name: "vendor", label: "Paid to (vendor)" },
          { name: "method", label: "Paid with", type: "select", options: METHOD_OPTIONS, defaultValue: "cash" },
          { name: "paidOn", label: "Date paid", type: "date", defaultValue: day, hint: "Leave blank if not paid yet" },
          { name: "referenceNumber", label: "OR / reference no." },
          { name: "unitId", label: "Room (optional)", type: "select", options: [{ value: "", label: "Whole building" }, ...units.map((u) => ({ value: u.id, label: `Room ${u.unitNumber}` }))] },
        ]}
      />
      <p className="text-xs text-th-faint">Spending from petty cash is recorded on the Petty cash page; paying a building water or electricity bill is done on the Utilities page. Both appear here automatically.</p>

      {rows.length === 0 ? (
        <Empty>No expenses for {month}.</Empty>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface">
          {rows.map((e) => (
            <li key={e.id} className={`space-y-1 p-3 text-sm ${e.status === "VOID" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-medium text-th-ink ${e.status === "VOID" ? "line-through" : ""}`}>{e.description}</p>
                  <p className="text-xs text-th-muted">
                    {formatDateOnly(fromDbDate(e.incurredOn))} · {EXPENSE_CATEGORIES[e.category as ExpenseCategory] ?? e.category}
                    {e.vendor ? ` · ${e.vendor}` : ""}
                    {e.unitId ? ` · Room ${units.find((u) => u.id === e.unitId)?.unitNumber ?? ""}` : ""}
                    {e.paidOn ? ` · paid ${formatDateOnly(fromDbDate(e.paidOn))}${e.method ? ` (${e.method.replace("_", " ")})` : ""}` : " · not paid yet"}
                    {e.referenceNumber ? ` · Ref ${e.referenceNumber}` : ""}
                    {e.source === "PETTY_CASH" ? " · from petty cash" : e.source === "UTILITY_BILL" ? " · utility bill" : ""}
                  </p>
                  {e.status === "VOID" && <p className="text-xs text-th-danger">Voided: {e.voidReason}</p>}
                </div>
                <Money c={e.amountCentavos} className="font-semibold" />
              </div>
              {e.status === "RECORDED" && (
                <div className="flex flex-wrap items-center gap-2">
                  <FileLink id={e.receiptFileId} label="Receipt" />
                  {!e.receiptFileId && <UploadForm url={`/api/operations/expenses/${e.id}`} toggleLabel="Add receipt" fileLabel="Receipt" submitLabel="Upload" />}
                  {!e.paidOn && e.source === "MANUAL" && (
                    <ActionForm url={`/api/operations/expenses/${e.id}`} body={{ action: "mark_paid" }} toggleLabel="Mark paid" submitLabel="Save" fields={[{ name: "paidOn", label: "Date paid", type: "date", required: true, defaultValue: day }, { name: "method", label: "Paid with", type: "select", options: METHOD_OPTIONS.slice(1) }, { name: "referenceNumber", label: "Reference", type: "text" }]} />
                  )}
                  {e.source !== "PETTY_CASH" && (
                    <ActionForm url={`/api/operations/expenses/${e.id}`} body={{ action: "void" }} toggleLabel="Void" submitLabel="Void expense" variant="destructive" successMessage="Voided" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
