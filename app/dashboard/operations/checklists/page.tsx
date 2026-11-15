import { ActionForm } from "@/components/collections/action-form";
import { Section } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { Empty, OpsNav } from "@/components/operations/bits";
import { adminPageContext } from "@/lib/collections/page-context";
import { DEFAULT_ITEMS, effectiveTemplate, itemsToLines, type ChecklistKind } from "@/lib/operations/checklists";

export default async function ChecklistTemplatesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) return <Empty>Add a property first.</Empty>;
  const kinds: ChecklistKind[] = ["MOVE_IN", "MOVE_OUT"];
  const templates = await Promise.all(kinds.map((k) => effectiveTemplate(actor.accountId, propertyId, k)));
  const name = properties.find((p) => p.id === propertyId)?.name ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-th-ink">Checklists</h1>
          <p className="text-sm text-th-muted">The items copied into each new move-in and move-out at {name}</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <OpsNav propertyId={propertyId} active="checklists" />
      <p className="text-sm text-th-muted">
        One item per line. Start a line with <code className="rounded bg-th-raised px-1">*</code> to make it required (a checklist can&apos;t be completed, and a vacancy can&apos;t be approved, until required items are done). Changes apply to checklists started from now on; existing ones keep their items.
      </p>
      {kinds.map((kind, i) => {
        const tpl = templates[i];
        const items = (tpl?.items as unknown as { label: string; required: boolean }[] | undefined) ?? DEFAULT_ITEMS[kind];
        return (
          <Section key={kind} title={kind === "MOVE_IN" ? "Move-in" : "Move-out"}>
            {!tpl && <p className="text-xs text-th-due">Using the built-in starting list{kind === "MOVE_OUT" ? " — replace it with Dawson's move-out procedure once it's provided" : ""}.</p>}
            {tpl?.propertyId === null && <p className="text-xs text-th-muted">Shared with every property in the account. Saving here creates a version just for {name}.</p>}
            <ActionForm
              url="/api/operations/templates"
              body={{ propertyId, kind }}
              submitLabel="Save checklist"
              successMessage="Checklist saved"
              fields={[
                { name: "name", label: "Name", type: "text", defaultValue: tpl?.name ?? (kind === "MOVE_IN" ? "Move-in checklist" : "Move-out checklist") },
                { name: "items", label: "Items", type: "textarea", required: true, rows: Math.min(14, items.length + 2), defaultValue: itemsToLines(items) },
              ]}
            />
          </Section>
        );
      })}
    </div>
  );
}
