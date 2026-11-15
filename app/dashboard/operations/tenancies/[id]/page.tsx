import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/collections/action-form";
import { FileLink, Money, Section, Stat } from "@/components/collections/bits";
import { Card, Empty } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";
import { currentActor } from "@/lib/collections/actor";
import { formatDateOnly, fromDbDate } from "@/lib/collections/calendar";
import { BillingError } from "@/lib/collections/errors";
import { loadTenantLedger } from "@/lib/collections/ledger";
import { prisma } from "@/lib/prisma";
import { checklistsFor } from "@/lib/operations/checklists";
import { adminTenant, today, toDateOnly } from "@/lib/operations/common";
import { depositSummary, FUND_LABEL, type Fund } from "@/lib/operations/deposits";
import { DOC_LABEL, leaseView } from "@/lib/operations/leases";
import { householdAdminView, MAX_OCCUPANTS } from "@/lib/operations/occupants";
import { ChecklistCard } from "../../checklist-card";

const KIND_LABEL: Record<string, string> = { RECEIVED: "Received", APPLIED: "Applied to charges", REFUNDED: "Refunded", FORFEITED: "Kept by owner", REVERSAL: "Undone" };

export default async function TenancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || actor.kind !== "ADMIN") redirect("/login");
  const tenant = await adminTenant(actor, id).catch((e) => {
    if (e instanceof BillingError) notFound();
    throw e;
  });
  const day = today();
  const [household, checklists, lease, deposits, ledger, moveOut, profile] = await Promise.all([
    householdAdminView(actor, id),
    checklistsFor(id),
    leaseView(id),
    depositSummary(id),
    loadTenantLedger(prisma, id, day),
    prisma.moveOut.findUnique({ where: { tenantId: id } }),
    prisma.billingProfile.findUnique({ where: { propertyId: tenant.unit.propertyId }, select: { enabled: true } }),
  ]);
  const moveIn = checklists.find((c) => c.kind === "MOVE_IN");
  const active = household.occupants.filter((o) => !o.movedOutOn);
  const funds: Fund[] = ["SECURITY_DEPOSIT", "ADVANCE_RENT"];
  const fundOptions = funds.map((f) => ({ value: f, label: FUND_LABEL[f] }));
  const latestTerm = lease.terms[lease.terms.length - 1] ?? null;
  const legacyDeposit = tenant.depositAmount != null ? `Recorded on the tenant profile: ₱${tenant.depositAmount.toLocaleString("en-PH")} (${tenant.depositPaid ? "marked paid" : "not marked paid"}). Record the actual money below so it's tracked separately from rent.` : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/operations/tenancies?propertyId=${tenant.unit.propertyId}`} className="text-sm text-th-accent hover:underline">← Tenancies</Link>
        <h1 className="mt-2 text-2xl font-bold text-th-ink">{tenant.name}</h1>
        <p className="text-sm text-th-muted">
          Room {tenant.unit.unitNumber} · {tenant.unit.property.name} · moved in {formatDateOnly(toDateOnly(tenant.moveInDate))}
          {tenant.moveOutDate ? ` · moved out ${formatDateOnly(toDateOnly(tenant.moveOutDate))}` : ""} ·{" "}
          <Link href={`/dashboard/tenants/${tenant.id}`} className="text-th-accent hover:underline">profile</Link>
          {profile ? (
            <>
              {" "}· <Link href={`/dashboard/collections/tenants/${tenant.id}`} className="text-th-accent hover:underline">billing</Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="People in the room" value={`${active.length} / ${MAX_OCCUPANTS}`} hint={household.billingCount != null ? `Water billed for ${household.billingCount}` : "No billing occupant count"} />
        <Stat label="Security deposit held" value={<Money c={deposits.balances.SECURITY_DEPOSIT} />} />
        <Stat label="Advance rent held" value={<Money c={deposits.balances.ADVANCE_RENT} />} />
        <Stat label="Rent balance" value={<Money c={ledger.outstandingCentavos} />} tone={ledger.outstandingCentavos ? "due" : undefined} hint="Collections ledger, excluding deposits" />
      </div>

      {/* Household */}
      <Section
        title="Household"
        action={
          active.length < MAX_OCCUPANTS && tenant.isActive ? (
            <ActionForm
              url={`/api/operations/tenancies/${tenant.id}`}
              body={{ action: "add_occupant" }}
              toggleLabel="Add a person"
              submitLabel="Add"
              successMessage="Added to the household"
              fields={[
                { name: "name", label: "Full name", type: "text", required: true },
                { name: "isPrimary", label: "This is the tenant of record", type: "checkbox", defaultValue: active.length === 0 },
                { name: "relationship", label: "Relationship to the tenant", type: "text", placeholder: "e.g. spouse, sibling, roommate" },
                { name: "phone", label: "Phone", type: "text" },
                { name: "movedInOn", label: "Moved in", type: "date", defaultValue: toDateOnly(tenant.moveInDate) },
                { name: "notes", label: "Private notes", type: "text" },
              ]}
            />
          ) : undefined
        }
      >
        {(household.mismatch || household.missingCount) && (
          <p className="rounded-lg border border-th-due/30 bg-th-due-soft p-3 text-sm text-th-due">
            {household.missingCount
              ? `${active.length} people are listed but no billing occupant count is set, so no water is charged.`
              : `${active.length} people are listed, but water is billed for ${household.billingCount}.`}{" "}
            {profile && (
              <Link href={`/dashboard/collections/tenants/${tenant.id}`} className="font-medium underline">
                Update the billing count
              </Link>
            )}
          </p>
        )}
        {household.occupants.length === 0 ? (
          <Empty>No one recorded yet. Add everyone living in the room, including the tenant (max {MAX_OCCUPANTS}).</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {household.occupants.map((o) => (
              <Card key={o.id} className={o.movedOutOn ? "opacity-70" : undefined}>
                <p className="font-medium text-th-ink">
                  {o.name} {o.isPrimary && <span className="text-xs font-normal text-th-muted">· tenant of record</span>}
                </p>
                <p className="text-xs text-th-muted">
                  {[o.relationship, o.phone].filter(Boolean).join(" · ") || "—"} · since {formatDateOnly(fromDbDate(o.movedInOn))}
                  {o.movedOutOn ? ` · left ${formatDateOnly(fromDbDate(o.movedOutOn))}` : ""}
                </p>
                {o.notes && <p className="mt-1 text-xs text-th-muted">{o.notes}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <FileLink id={o.idFileId} label="View ID" />
                  <FileLink id={o.photoFileId} label="View photo" />
                </div>
                {!o.movedOutOn && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <UploadForm url={`/api/operations/occupants/${o.id}/files`} hidden={{ which: "id" }} toggleLabel={o.idFileId ? "Replace ID" : "Upload ID"} fileLabel="Government ID (photo or PDF)" submitLabel="Upload" successMessage="ID saved privately" />
                    <UploadForm url={`/api/operations/occupants/${o.id}/files`} hidden={{ which: "photo" }} toggleLabel={o.photoFileId ? "Replace photo" : "Upload photo"} fileLabel="Photo" accept="image/jpeg,image/png,image/webp" submitLabel="Upload" successMessage="Photo saved privately" />
                    <ActionForm url={`/api/operations/occupants/${o.id}`} body={{ action: "move_out" }} toggleLabel="Moved out" submitLabel="Save" fields={[{ name: "movedOutOn", label: "Moved-out date", type: "date", required: true, defaultValue: day }]} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-th-faint">IDs and photos are private: only the office can open them. Tenants see names only; caretakers see nothing here.</p>
      </Section>

      {/* Move-in */}
      <Section title="Move-in checklist">
        {moveIn ? (
          <ChecklistCard checklist={moveIn} />
        ) : (
          <ActionForm url={`/api/operations/tenancies/${tenant.id}`} body={{ action: "start_checklist", kind: "MOVE_IN" }} submitLabel="Start the move-in checklist" successMessage="Checklist started" />
        )}
      </Section>

      {/* Lease */}
      <Section
        title="Lease"
        action={
          <ActionForm
            url={`/api/operations/tenancies/${tenant.id}`}
            body={{ action: "add_lease_term" }}
            toggleLabel={lease.terms.length ? "Add a term" : "Record lease dates"}
            submitLabel="Save"
            successMessage="Lease term saved"
            fields={[
              { name: "startDate", label: "Start", type: "date", required: true, defaultValue: lease.terms.length ? undefined : toDateOnly(tenant.moveInDate) },
              { name: "endDate", label: "End", type: "date", hint: "Leave blank for month-to-month" },
              { name: "monthlyRentCentavos", label: "Monthly rent in the lease (₱, for reference)", type: "pesos" },
              { name: "notes", label: "Notes", type: "text" },
            ]}
          />
        }
      >
        {lease.terms.length === 0 ? (
          <Empty>No lease dates recorded.</Empty>
        ) : (
          <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface text-sm">
            {lease.terms.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="text-th-ink">
                  {formatDateOnly(fromDbDate(t.startDate))} – {t.endDate ? formatDateOnly(fromDbDate(t.endDate)) : "open-ended"}
                  {t.renewalOfId && <span className="text-th-muted"> · renewal</span>}
                  {t.monthlyRentCentavos != null && <span className="text-th-muted"> · <Money c={t.monthlyRentCentavos} />/month</span>}
                  {lease.current?.id === t.id && <span className="ml-1 rounded-full bg-th-brand-soft px-2 py-0.5 text-xs text-th-accent">current</span>}
                </span>
                {t.id === latestTerm?.id && t.endDate && tenant.isActive && (
                  <ActionForm
                    url={`/api/operations/leases/${t.id}`}
                    body={{ action: "renew" }}
                    toggleLabel="Renew"
                    submitLabel="Renew lease"
                    successMessage="Lease renewed"
                    fields={[
                      { name: "endDate", label: "New end date", type: "date", required: true },
                      { name: "monthlyRentCentavos", label: "New monthly rent (₱, optional)", type: "pesos", hint: "For the record only — update the room's rent in Collections → room settings so bills change too." },
                      { name: "notes", label: "Notes", type: "text" },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium text-th-ink">Documents</p>
          {lease.documents.length === 0 ? (
            <p className="text-sm text-th-muted">No lease files yet. Upload the owner&apos;s lease; after it&apos;s printed and signed, upload the signed copy (the tenant can also upload it from their portal).</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {lease.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-th-ink">{d.title}</span>
                  <span className="text-xs text-th-muted">{DOC_LABEL[d.kind as keyof typeof DOC_LABEL] ?? d.kind} · uploaded by {d.uploadedByRole === "TENANT" ? "tenant" : "office"} {formatDateOnly(toDateOnly(d.createdAt))}</span>
                  <FileLink id={d.fileId} label="Open" />
                </li>
              ))}
            </ul>
          )}
          <UploadForm
            url={`/api/operations/tenancies/${tenant.id}/documents`}
            toggleLabel="Upload a lease file"
            submitLabel="Upload"
            successMessage="Saved — the tenant can see it in their documents"
            fields={[
              { name: "kind", label: "What is it", type: "select", options: [{ value: "OWNER_LEASE", label: "Lease from the owner (to print and sign)" }, { value: "SIGNED_COPY", label: "Signed copy" }, { value: "OTHER", label: "Other" }] },
              { name: "title", label: "Title", placeholder: "e.g. Lease 2027" },
              ...(lease.terms.length ? [{ name: "leaseTermId", label: "For which term", type: "select" as const, options: [{ value: "", label: "—" }, ...lease.terms.map((t) => ({ value: t.id, label: `${fromDbDate(t.startDate)} – ${t.endDate ? fromDbDate(t.endDate) : "open"}` }))] }] : []),
            ]}
          />
          <p className="text-xs text-th-faint">Lease files are shown to this tenant in their portal. No e-signature or legal-compliance claim is made for uploaded documents.</p>
        </div>
      </Section>

      {/* Deposits */}
      <Section title="Security deposit and advance rent">
        {legacyDeposit && deposits.rows.length === 0 && <p className="text-sm text-th-muted">{legacyDeposit}</p>}
        <p className="text-xs text-th-faint">Held money isn&apos;t rent income and doesn&apos;t reduce the rent balance until you apply it to charges.</p>
        <div className="flex flex-wrap items-start gap-2">
          <ActionForm
            url={`/api/operations/tenancies/${tenant.id}`}
            body={{ action: "receive_deposit" }}
            toggleLabel="Record money received"
            submitLabel="Record"
            successMessage="Recorded"
            fields={[
              { name: "fund", label: "For", type: "select", options: fundOptions },
              { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
              { name: "occurredOn", label: "Date received", type: "date", required: true, defaultValue: day },
              { name: "method", label: "Method", type: "select", options: [{ value: "cash", label: "Cash" }, { value: "gcash", label: "GCash" }, { value: "maya", label: "Maya" }, { value: "bank", label: "Bank transfer" }, { value: "other", label: "Other" }] },
              { name: "reference", label: "Reference / OR no.", type: "text" },
            ]}
          />
          {profile && (deposits.balances.SECURITY_DEPOSIT > 0 || deposits.balances.ADVANCE_RENT > 0) && (
            <ActionForm
              url={`/api/operations/tenancies/${tenant.id}`}
              body={{ action: "apply_deposit" }}
              toggleLabel="Apply to unpaid charges"
              submitLabel="Apply"
              successMessage="Applied to the oldest unpaid charges"
              fields={[
                { name: "fund", label: "From", type: "select", options: fundOptions },
                { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true, hint: `Owed now: ₱${(ledger.outstandingCentavos / 100).toFixed(2)}` },
                { name: "reason", label: "Reason", type: "text", required: true, placeholder: "e.g. Advance rent for first month / damages at move-out" },
              ]}
            />
          )}
          {(deposits.balances.SECURITY_DEPOSIT > 0 || deposits.balances.ADVANCE_RENT > 0) && (
            <ActionForm
              url={`/api/operations/tenancies/${tenant.id}`}
              body={{ action: "release_deposit" }}
              toggleLabel="Refund or keep"
              submitLabel="Record"
              successMessage="Recorded"
              fields={[
                { name: "fund", label: "From", type: "select", options: fundOptions },
                { name: "kind", label: "What happened", type: "select", options: [{ value: "REFUNDED", label: "Refunded to the tenant" }, { value: "FORFEITED", label: "Kept by the owner (forfeited)" }] },
                { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
                { name: "occurredOn", label: "Date", type: "date", required: true, defaultValue: day },
                { name: "reason", label: "Reason", type: "text", required: true },
                { name: "method", label: "Method", type: "text" },
                { name: "reference", label: "Reference", type: "text" },
              ]}
            />
          )}
        </div>
        {deposits.rows.length > 0 && (
          <ul className="divide-y divide-th-line rounded-xl border border-th-line bg-th-surface text-sm">
            {deposits.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0 text-th-ink">
                  {formatDateOnly(fromDbDate(r.occurredOn))} · {FUND_LABEL[r.fund as Fund]} · {KIND_LABEL[r.kind] ?? r.kind}
                  {r.reason && <span className="text-th-muted"> · {r.reason}</span>}
                  {r.reference && <span className="text-th-muted"> · Ref {r.reference}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Money c={r.amountCentavos} className={r.amountCentavos < 0 ? "text-th-muted" : "font-medium"} />
                  {r.kind !== "REVERSAL" && !deposits.reversedIds.has(r.id) && (
                    <ActionForm url={`/api/operations/deposits/${r.id}`} body={{ action: "reverse" }} toggleLabel="Undo" submitLabel="Undo entry" variant="destructive" successMessage="Undone" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
                  )}
                  {deposits.reversedIds.has(r.id) && <span className="text-xs text-th-muted">undone</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Move-out */}
      <Section title="Move-out">
        {moveOut && moveOut.status !== "CANCELLED" ? (
          <Card>
            <p className="text-sm text-th-ink">
              {moveOut.status === "COMPLETED" ? `Completed — vacancy approved ${moveOut.actualDate ? formatDateOnly(fromDbDate(moveOut.actualDate)) : ""}` : `In progress — planned for ${formatDateOnly(fromDbDate(moveOut.plannedDate))}`}
            </p>
            <Link href={`/dashboard/operations/moveouts/${moveOut.id}`} className="mt-1 inline-block text-sm font-medium text-th-accent hover:underline">Open the move-out →</Link>
          </Card>
        ) : tenant.isActive ? (
          <ActionForm
            url={`/api/operations/tenancies/${tenant.id}`}
            body={{ action: "start_moveout" }}
            toggleLabel="Start move-out"
            submitLabel="Start"
            successMessage="Move-out started"
            fields={[
              { name: "plannedDate", label: "Planned move-out date", type: "date", required: true },
              { name: "noticeDate", label: "Notice received on", type: "date", defaultValue: day },
              { name: "reason", label: "Reason (optional)", type: "text" },
            ]}
          />
        ) : (
          <p className="text-sm text-th-muted">This tenancy has ended.</p>
        )}
        {moveOut?.status === "CANCELLED" && <p className="text-xs text-th-muted">An earlier move-out was cancelled: {moveOut.cancelledReason}</p>}
      </Section>

      <Section title="Messages">
        <Link href={`/dashboard/operations/inbox?propertyId=${tenant.unit.propertyId}&tenantId=${tenant.id}`} className="text-sm font-medium text-th-accent hover:underline">Conversations with {tenant.name} →</Link>
      </Section>
    </div>
  );
}
