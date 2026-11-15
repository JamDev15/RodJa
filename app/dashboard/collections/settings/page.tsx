import { ActionForm } from "@/components/collections/action-form";
import { LogoUpload } from "@/components/collections/logo-upload";
import { Money, Section, SubNav } from "@/components/collections/bits";
import { PropertyPicker } from "@/components/collections/property-picker";
import { centavosToInput } from "@/lib/collections/money";
import { listCaretakers } from "@/lib/collections/caretakers";
import { cyclesForMonth, formatDateOnly, monthOf, todayIn } from "@/lib/collections/calendar";
import { adminPageContext } from "@/lib/collections/page-context";
import { getProfile, scheduleOf } from "@/lib/collections/profile";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const FREQ: Record<string, string> = { EVERY_CYCLE: "every cycle", MONTHLY: "monthly", EVERY_N_MONTHS: "every few months" };

export default async function CollectionsSettingsPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const sp = await searchParams;
  const { actor, properties, propertyId } = await adminPageContext(sp.propertyId);
  if (!propertyId) redirect("/dashboard/collections");
  const profile = await getProfile(propertyId);
  if (!profile) redirect(`/dashboard/collections?propertyId=${propertyId}`);
  const today = todayIn(profile.timezone);
  const cycles = scheduleOf(profile).cycles;
  const units = await prisma.unit.findMany({
    where: { propertyId },
    orderBy: { unitNumber: "asc" },
    include: { roomBilling: true, recurringCharges: { orderBy: { createdAt: "asc" } }, tenants: { where: { isActive: true }, orderBy: { moveInDate: "asc" } } },
  });
  const caretakers = (await listCaretakers(actor)).filter((c) => c.caretakerProperties.some((p) => p.propertyId === propertyId));
  const example = cyclesForMonth(scheduleOf(profile), "2027-02");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Collections setup</h1>
          <p className="text-sm text-th-muted">Changes apply to statements generated from now on. Issued statements keep their amounts.</p>
        </div>
        <PropertyPicker properties={properties} value={propertyId} />
      </div>
      <SubNav propertyId={propertyId} active="settings" />

      <Section title="Statement logo">
        <LogoUpload propertyId={propertyId} logoFileId={profile.logoFileId} />
      </Section>

      <Section title="Billing schedule and rules">
        <ActionForm
          url="/api/collections/profile"
          body={{ propertyId }}
          submitLabel="Save settings"
          size="default"
          successMessage="Settings saved"
          fields={[
            { name: "enabled", label: "Statement billing is on for this property", type: "checkbox", defaultValue: profile.enabled },
            { name: "cycleDays", label: "Billing cycle days", type: "text", defaultValue: cycles.map((c) => c.day).join(", "), hint: `Days of the month, e.g. "15, 30". In February these fall on ${example.map((c) => formatDateOnly(c.cycleDate)).join(" and ")}.` },
            { name: "shortMonthPolicy", label: "When a cycle day doesn't exist in a month", type: "select", defaultValue: profile.shortMonthPolicy, options: [{ value: "LAST_DAY", label: "Use the last day of the month (recommended)" }, { value: "NEXT_MONTH_FIRST", label: "Use the 1st of the next month" }] },
            { name: "generateDaysBefore", label: "Prepare drafts this many days before the cycle date", type: "number", defaultValue: String(profile.generateDaysBefore) },
            { name: "distributeDaysBefore", label: "Email statements this many days before the cycle date", type: "number", defaultValue: String(profile.distributeDaysBefore), hint: "0 = on the cycle date. Statements are only emailed after you issue them." },
            { name: "dueDaysAfter", label: "Payment due this many days after the cycle date", type: "number", defaultValue: String(profile.dueDaysAfter) },
            { name: "monthlyCycleKey", label: "Once-a-month items (water, internet) go on", type: "select", defaultValue: profile.monthlyCycleKey, options: cycles.map((c) => ({ value: c.key, label: `The ${ordinal(c.day)} cycle` })) },
            { name: "autoGenerate", label: "Prepare drafts automatically on schedule", type: "checkbox", defaultValue: profile.autoGenerate },
            { name: "requireReview", label: "Hold drafts for my review before issuing", type: "checkbox", defaultValue: profile.requireReview, hint: "Turn off only if you want scheduled statements issued without review." },
            { name: "waterEnabled", label: "Charge occupant-based water monthly", type: "checkbox", defaultValue: profile.waterEnabled },
            { name: "waterBaseCentavos", label: "Water for 1 occupant (₱)", type: "pesos", defaultValue: centavosToInput(profile.waterBaseCentavos) },
            { name: "waterPerExtraCentavos", label: "Each additional occupant (₱)", type: "pesos", defaultValue: centavosToInput(profile.waterPerExtraCentavos) },
            { name: "waterMaxOccupants", label: "Maximum occupants per room", type: "number", defaultValue: String(profile.waterMaxOccupants) },
            { name: "penaltyEnabled", label: "Add late penalties automatically", type: "checkbox", defaultValue: profile.penaltyEnabled, hint: "Needs a percentage and a grace period. One penalty per unpaid statement, on that statement's own charges — never on earlier balances or penalties." },
            { name: "penaltyPercent", label: "Late penalty (%)", type: "text", defaultValue: profile.penaltyRateBps != null ? String(profile.penaltyRateBps / 100) : "", placeholder: "Awaiting owner decision" },
            { name: "penaltyGraceDays", label: "Grace period (days after due date)", type: "number", defaultValue: profile.penaltyGraceDays != null ? String(profile.penaltyGraceDays) : "", placeholder: "Awaiting owner decision" },
            { name: "meterUnitLabel", label: "Water meter unit", type: "text", defaultValue: profile.meterUnitLabel },
            { name: "meterReadingFrequency", label: "How often readings are taken", type: "text", defaultValue: profile.meterReadingFrequency ?? "", placeholder: "e.g. Every 15th" },
            { name: "meterAllowance", label: "Usage allowance between readings", type: "text", defaultValue: profile.meterAllowance?.toString() ?? "", placeholder: "Awaiting owner decision", hint: "Readings above this are flagged. Leave blank to only record usage." },
            { name: "meterExcessRateCentavos", label: "Excess rate per unit over allowance (₱)", type: "pesos", defaultValue: centavosToInput(profile.meterExcessRateCentavos), placeholder: "Awaiting owner decision", hint: "Proposed excess charges always need your approval before billing." },
            { name: "vecoEnabled", label: "Track VECO electricity receipts", type: "checkbox", defaultValue: profile.vecoEnabled },
            { name: "vecoReceiptDueDay", label: "A month's VECO receipt is due by this day of the next month", type: "number", defaultValue: String(profile.vecoReceiptDueDay) },
            { name: "paymentInstructions", label: "Payment instructions printed on statements", type: "textarea", defaultValue: profile.paymentInstructions ?? "", placeholder: "GCash number, bank account, where to pay cash…" },
          ]}
        />
      </Section>

      <Section title="Rooms">
        <p className="text-sm text-th-muted">
          Rent is set per room. Choose whether the amount you enter is charged <strong>every cycle</strong> or is the <strong>monthly total split</strong> across the cycles — the app never assumes, so a monthly rent can&apos;t be doubled by mistake.
        </p>
        <div className="space-y-4">
          {units.map((u) => (
            <div key={u.id} className="space-y-3 rounded-xl border border-th-line bg-th-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-th-ink">Room {u.unitNumber}</h3>
                <span className="text-xs text-th-muted">{u.tenants.length ? u.tenants.map((t) => `${t.name} (${t.occupantCount ?? "?"} occupant${t.occupantCount === 1 ? "" : "s"})`).join(", ") : "Vacant — no statements"}</span>
              </div>
              <ul className="space-y-1 text-sm">
                {u.recurringCharges.length === 0 && <li className="text-th-faint">No recurring charges yet.</li>}
                {u.recurringCharges.map((rc) => {
                  const ended = !rc.isActive || (rc.endMonth != null && rc.endMonth < monthOf(today));
                  return (
                    <li key={rc.id} className={`flex flex-wrap items-center justify-between gap-2 ${ended ? "text-th-faint line-through" : "text-th-ink"}`}>
                      <span>
                        {rc.description}: <Money c={rc.amountCentavos} />{" "}
                        {rc.type === "RENT" ? (rc.amountBasis === "MONTHLY_SPLIT" ? "per month, split across cycles" : "every cycle") : FREQ[rc.frequency]}
                        {rc.frequency === "EVERY_N_MONTHS" ? ` (every ${rc.intervalMonths} months)` : ""} · from {rc.startMonth}
                        {rc.endMonth ? ` to ${rc.endMonth}` : ""}
                      </span>
                      {!ended && (
                        <ActionForm url={`/api/collections/recurring/${rc.id}`} toggleLabel="End" fields={[{ name: "endMonth", label: "Last month to bill (blank = stop now)", type: "month" }]} submitLabel="End charge" successMessage="Recurring charge ended" />
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                <ActionForm
                  url={`/api/collections/rooms/${u.id}`}
                  body={{ action: "add_recurring", type: "RENT", frequency: "EVERY_CYCLE", description: "Room rent" }}
                  toggleLabel="Add rent"
                  submitLabel="Add rent"
                  successMessage="Rent added"
                  fields={[
                    { name: "amountCentavos", label: "Rent amount (₱)", type: "pesos", required: true },
                    { name: "amountBasis", label: "This amount is…", type: "select", options: [{ value: "", label: "Choose…" }, { value: "PER_CYCLE", label: "charged every cycle (twice a month)" }, { value: "MONTHLY_SPLIT", label: "the monthly total, split across both cycles" }] },
                    { name: "startMonth", label: "First month", type: "month", required: true, defaultValue: monthOf(today) },
                  ]}
                />
                <ActionForm
                  url={`/api/collections/rooms/${u.id}`}
                  body={{ action: "add_recurring", amountBasis: "PER_OCCURRENCE" }}
                  toggleLabel="Add internet / parking / other"
                  submitLabel="Add charge"
                  successMessage="Charge added"
                  fields={[
                    { name: "type", label: "Type", type: "select", options: [{ value: "INTERNET", label: "Internet (monthly)" }, { value: "PARKING", label: "Parking" }, { value: "OTHER", label: "Other recurring" }] },
                    { name: "description", label: "Description", type: "text", required: true, placeholder: "e.g. Internet 50 Mbps" },
                    { name: "amountCentavos", label: "Amount (₱)", type: "pesos", required: true },
                    { name: "frequency", label: "How often", type: "select", options: [{ value: "MONTHLY", label: "Monthly" }, { value: "EVERY_CYCLE", label: "Every cycle" }, { value: "EVERY_N_MONTHS", label: "Every few months" }] },
                    { name: "intervalMonths", label: "Every how many months (if every few months)", type: "number", defaultValue: "1" },
                    { name: "startMonth", label: "First month", type: "month", required: true, defaultValue: monthOf(today) },
                  ]}
                />
                <ActionForm
                  url={`/api/collections/rooms/${u.id}`}
                  body={{ action: "settings" }}
                  toggleLabel="Meter, VECO & water override"
                  submitLabel="Save room"
                  successMessage="Room saved"
                  fields={[
                    { name: "meterId", label: "Water meter ID", type: "text", defaultValue: u.roomBilling?.meterId ?? "" },
                    { name: "vecoAccountNumber", label: "VECO account number", type: "text", defaultValue: u.roomBilling?.vecoAccountNumber ?? "" },
                    { name: "waterOverrideCentavos", label: "Override monthly water (₱) — blank to use occupants", type: "pesos", defaultValue: centavosToInput(u.roomBilling?.waterOverrideCentavos) },
                    { name: "waterOverrideReason", label: "Reason for the override", type: "text", defaultValue: u.roomBilling?.waterOverrideReason ?? "" },
                  ]}
                />
              </div>
              {(u.roomBilling?.meterId || u.roomBilling?.vecoAccountNumber || u.roomBilling?.waterOverrideCentavos != null) && (
                <p className="text-xs text-th-muted">
                  {u.roomBilling?.meterId && <>Meter {u.roomBilling.meterId} · </>}
                  {u.roomBilling?.vecoAccountNumber && <>VECO {u.roomBilling.vecoAccountNumber} · </>}
                  {u.roomBilling?.waterOverrideCentavos != null && (
                    <>Water overridden to <Money c={u.roomBilling.waterOverrideCentavos} /> ({u.roomBilling.waterOverrideReason})</>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Caretakers">
        <p className="text-sm text-th-muted">Caretakers sign in at the normal login page and can only enter water meter readings. They can&apos;t see payments, balances or reports.</p>
        <ul className="space-y-2 text-sm">
          {caretakers.length === 0 && <li className="text-th-faint">No caretakers yet.</li>}
          {caretakers.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-th-line bg-th-surface px-3 py-2">
              <span className="text-th-ink">{c.name} · <span className="text-th-muted">{c.email}</span></span>
              <ActionForm url={`/api/collections/caretakers/${c.id}`} method="DELETE" submitLabel="Remove" variant="outline" successMessage="Caretaker removed" />
            </li>
          ))}
        </ul>
        <ActionForm
          url="/api/collections/caretakers"
          body={{ propertyIds: [propertyId] }}
          toggleLabel="Add caretaker"
          submitLabel="Create caretaker login"
          successMessage="Caretaker added"
          fields={[
            { name: "name", label: "Name", type: "text", required: true },
            { name: "email", label: "Email (their login)", type: "text", required: true },
            { name: "password", label: "Temporary password (8+ characters)", type: "text", required: true },
          ]}
        />
      </Section>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
