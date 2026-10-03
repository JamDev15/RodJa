// Client-safe starting template for a residential lease. The owner edits it
// freely before signing; nothing here is legal advice.

export interface ContractTemplateInput {
  ownerName: string;
  businessName: string;
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  unitNumber: string;
  monthlyRent: number | null;
  deposit: number | null;
  dueDay: number;
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null;
}

const peso = (n: number | null) =>
  n == null ? "PHP ________" : `PHP ${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2 }).format(n)}`;

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "____________";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function defaultContractTitle(unitNumber: string): string {
  return `Residential Lease Agreement – Unit ${unitNumber}`;
}

export function defaultContractBody(i: ContractTemplateInput): string {
  return `This Residential Lease Agreement ("Agreement") is entered into by and between:

${i.ownerName}, owner/operator of ${i.businessName} (the "Lessor"); and

${i.tenantName} (the "Lessee").

1. PREMISES
The Lessor leases to the Lessee Unit ${i.unitNumber} of ${i.propertyName}, located at ${i.propertyAddress} (the "Premises"), to be used solely as a private residence.

2. TERM
The lease begins on ${fmt(i.startDate)} and ends on ${fmt(i.endDate)}, unless renewed or terminated earlier under this Agreement. Renewal must be agreed in writing by both parties.

3. RENT
Monthly rent is ${peso(i.monthlyRent)}, payable on or before the ${ordinal(i.dueDay)} day of each month via GCash, Maya, bank transfer, or cash as agreed. The Lessee will upload proof of each payment through the TenantHub tenant portal.

4. SECURITY DEPOSIT
The Lessee pays a security deposit of ${peso(i.deposit)}. It will be returned within thirty (30) days after the Lessee moves out, less any unpaid rent, unpaid utilities, and the cost of repairing damage beyond normal wear and tear. The deposit may not be applied as the last month's rent unless the Lessor agrees in writing.

5. UTILITIES
Electricity, water, internet, and other utilities used in the Premises are paid by the Lessee unless stated otherwise here: ______________________.

6. USE AND HOUSE RULES
The Lessee shall keep the Premises clean and in good condition, shall not sublease or assign the Premises without written consent, shall not keep illegal or hazardous items, and shall follow the building's house rules, including on visitors, quiet hours, and pets.

7. REPAIRS AND MAINTENANCE
The Lessee shall report needed repairs promptly through the tenant portal. The Lessor handles major repairs not caused by the Lessee. Damage caused by the Lessee or their guests is charged to the Lessee.

8. LATE PAYMENT
Rent unpaid after the due date may incur a late fee of ______________________. Repeated non-payment may be grounds for termination in accordance with applicable law.

9. TERMINATION
Either party may end this Agreement by giving at least thirty (30) days' written notice. Upon moving out, the Lessee shall return all keys and leave the Premises in the same condition as received, apart from normal wear and tear.

10. ENTIRE AGREEMENT
This Agreement is the complete agreement between the parties and may only be amended in writing signed by both. It is governed by the laws of the Republic of the Philippines.

Both parties confirm they have read and understood this Agreement and agree to sign it electronically.`;
}
