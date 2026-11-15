import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { ActionForm } from "@/components/collections/action-form";
import { Money, Section } from "@/components/collections/bits";
import { Card, Photos } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { currentActor } from "@/lib/collections/actor";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";
import { BillingError } from "@/lib/collections/errors";
import { today } from "@/lib/operations/common";
import { FUND_LABEL } from "@/lib/operations/deposits";
import { moveOutDates, moveOutView } from "@/lib/operations/moveout";
import { ChecklistCard } from "../../checklist-card";

export default async function MoveOutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const v = await moveOutView(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  const mo = v.moveOut;
  const dates = moveOutDates(mo);
  const open = mo.status === "IN_PROGRESS";
  const day = today();
  const ready = v.checks.every((c) => c.ok);
  const photos = (mo.inspectionPhotoIds as string[] | null) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/operations/tenancies/${v.tenant.id}`} className="text-sm text-th-accent hover:underline">← {v.tenant.name}</Link>
        <h1 className="mt-2 text-2xl font-bold text-th-ink">Move-out · Room {v.tenant.unit.unitNumber}</h1>
        <p className="text-sm text-th-muted">
          {v.tenant.name} · planned {formatDateOnly(dates.planned)}
          {dates.notice ? ` · notice ${formatDateOnly(dates.notice)}` : ""}
          {mo.reason ? ` · ${mo.reason}` : ""} · {mo.status === "COMPLETED" ? `completed ${dates.actual ? formatDateOnly(dates.actual) : ""}` : mo.status === "CANCELLED" ? "cancelled" : "in progress"}
        </p>
        <p className="mt-2 rounded-lg border border-th-line bg-th-raised p-3 text-xs text-th-muted">
          Steps follow a general move-out flow until Dawson&apos;s own move-out procedure is provided; edit the move-out checklist template to match it.
        </p>
      </div>

      <Section title="1. Checklist">
        {v.checklist ? <ChecklistCard checklist={v.checklist} /> : <p className="text-sm text-th-muted">No checklist.</p>}
      </Section>

      <Section title="2. Inspection">
        {mo.inspectionNotes ? (
          <Card>
            <p className="whitespace-pre-wrap text-sm text-th-ink">{mo.inspectionNotes}</p>
            {mo.inspectedAt && <p className="mt-1 text-xs text-th-muted">Recorded {formatDateOnly(mo.inspectedAt.toISOString().slice(0, 10))}</p>}
            <Photos ids={photos} />
          </Card>
        ) : (
          <Photos ids={photos} />
        )}
        {open && (
          <div className="flex flex-wrap items-start gap-2">
            <ActionForm url={`/api/operations/moveouts/${mo.id}`} body={{ action: "inspection" }} toggleLabel={mo.inspectionNotes ? "Edit inspection notes" : "Record inspection"} submitLabel="Save" successMessage="Inspection saved" fields={[{ name: "notes", label: "Condition of the room, missing items, damages found", type: "textarea", required: true, defaultValue: mo.inspectionNotes ?? "" }]} />
            <UploadForm url={`/api/operations/moveouts/${mo.id}`} toggleLabel="Add inspection photo" fileLabel="Photo" accept="image/jpeg,image/png,image/webp" submitLabel="Upload" successMessage="Photo saved" />
          </div>
        )}
      </Section>

      <Section title="3. Final water meter reading">
        {v.finalReading ? (
          <p className="text-sm text-th-ink">
            {v.finalReading.value.toString()} on {formatDateOnly(fromDbDate(v.finalReading.readingDate))}
            {v.finalReading.status !== "ACTIVE" && <span className="text-th-danger"> (voided — record it again)</span>}
          </p>
        ) : (
          <p className="text-sm text-th-muted">Not recorded yet.</p>
        )}
        {open && (!v.finalReading || v.finalReading.status !== "ACTIVE") && (
          <ActionForm
            url={`/api/operations/moveouts/${mo.id}`}
            body={{ action: "final_reading" }}
            toggleLabel="Record final reading"
            submitLabel="Save reading"
            successMessage="Final reading recorded"
            fields={[
              { name: "value", label: "Meter reading", type: "text", required: true },
              { name: "readingDate", label: "Date", type: "date", required: true, defaultValue: day },
              { name: "isMeterReset", label: "Meter was replaced or reset", type: "checkbox" },
            ]}
          />
        )}
        <p className="text-xs text-th-faint">Uses the same checks as the caretaker&apos;s readings; any excess usage goes through the normal approval.</p>
      </Section>

      <Section title="4. Damages">
        {v.damages.length === 0 ? (
          <p className="text-sm text-th-muted">No damages charged.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {v.damages.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span className="text-th-ink">{d.description}</span>
                <Money c={d.amountCentavos} />
              </li>
            ))}
          </ul>
        )}
        {open && (
          <ActionForm
            url={`/api/operations/moveouts/${mo.id}`}
            body={{ action: "damage" }}
            withRequestId
            toggleLabel="Charge for damages"
            submitLabel="Post charge"
            successMessage="Charged to the tenant's balance"
            fields={[
              { name: "description", label: "What was damaged", type: "text", required: true },
              { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
            ]}
          />
        )}
        <p className="text-xs text-th-faint">Damages are posted to the rent ledger, so they show on the tenant&apos;s balance and can be paid from the deposit. Mistakes are waived from the billing page, not deleted.</p>
      </Section>

      <Section title="5. Settle the deposit and balance">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs text-th-muted">Rent balance</p>
            <p className="text-lg font-bold text-th-ink"><Money c={v.ledger.outstandingCentavos} /></p>
          </Card>
          {(["SECURITY_DEPOSIT", "ADVANCE_RENT"] as const).map((f) => (
            <Card key={f}>
              <p className="text-xs text-th-muted">{FUND_LABEL[f]} still held</p>
              <p className="text-lg font-bold text-th-ink"><Money c={v.deposits.balances[f]} /></p>
            </Card>
          ))}
        </div>
        <p className="text-sm text-th-muted">
          Apply held money to what&apos;s owed, then refund (or record as kept) whatever is left —{" "}
          <Link href={`/dashboard/operations/tenancies/${v.tenant.id}`} className="text-th-accent hover:underline">on the tenancy page</Link>.
        </p>
      </Section>

      <Section title="6. Approve the vacancy">
        <ul className="space-y-1 text-sm">
          {v.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-th-paid" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-th-faint" />}
              <span className={c.ok ? "text-th-ink" : "text-th-muted"}>
                {c.label}
                {c.detail && <span className="block text-xs">{c.detail}</span>}
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2">
            {v.balanceOk ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-th-paid" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-th-due" />}
            <span className="text-th-ink">{v.balanceOk ? "Rent balance is zero" : "Rent balance isn't zero — you'll need to record why it stays open"}</span>
          </li>
        </ul>
        {open && (
          <div className="flex flex-wrap items-start gap-2">
            {ready && (
              <ActionForm
                url={`/api/operations/moveouts/${mo.id}`}
                body={{ action: "approve" }}
                toggleLabel="Approve vacancy"
                submitLabel="Approve and end the tenancy"
                variant="success"
                successMessage="Vacancy approved — the room is vacant"
                fields={[
                  { name: "actualDate", label: "Date the tenant left", type: "date", required: true, defaultValue: dates.planned <= day ? dates.planned : day },
                  ...(v.balanceOk ? [] : [{ name: "outstandingNote", label: "Why the balance stays open", type: "text" as const, required: true }]),
                ]}
              />
            )}
            <ActionForm url={`/api/operations/moveouts/${mo.id}`} body={{ action: "cancel" }} toggleLabel="Cancel move-out" submitLabel="Cancel move-out" variant="destructive" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
          </div>
        )}
        {mo.status === "COMPLETED" && mo.outstandingNote && (
          <p className="text-sm text-th-muted">Closed with <Money c={mo.outstandingAtCloseCentavos ?? 0} /> outstanding: {mo.outstandingNote}</p>
        )}
      </Section>
    </div>
  );
}
