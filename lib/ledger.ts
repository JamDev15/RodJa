import { prisma } from "@/lib/prisma";

export interface LedgerFields {
  rentAmount: number;
  rentPaidAmount?: number | null;
  rentPaid?: boolean;
  electricAmount?: number | null;
  electricPaidAmount?: number | null;
  electricPaid?: boolean;
  waterAmount?: number | null;
  waterPaidAmount?: number | null;
  waterPaid?: boolean;
  otherAmount?: number | null;
  otherPaidAmount?: number | null;
  otherLabel?: string | null;
  otherPaid?: boolean;
  balance?: number;
  balancePaid?: boolean;
  notes?: string | null;
}

// Shared by the ledger form (app/api/ledger POST) and the chat assistant so
// both write identical rows — paid booleans are derived from paid amounts
// when a paid amount is given, otherwise fall back to the explicit flag.
export async function upsertMonthlyLedger(tenantId: string, month: string, fields: LedgerFields) {
  const rentAmount = fields.rentAmount;
  const rentPaidAmt = fields.rentPaidAmount ?? null;
  const electricAmt = fields.electricAmount ?? null;
  const electricPaidAmt = fields.electricPaidAmount ?? null;
  const waterAmt = fields.waterAmount ?? null;
  const waterPaidAmt = fields.waterPaidAmount ?? null;
  const otherAmt = fields.otherAmount ?? null;
  const otherPaidAmt = fields.otherPaidAmount ?? null;
  const balance = fields.balance ?? 0;
  const balancePaid = fields.balancePaid ?? false;

  const rentPaid = rentPaidAmt != null ? rentPaidAmt >= rentAmount : (fields.rentPaid ?? false);
  const electricPaid = electricAmt != null && electricPaidAmt != null ? electricPaidAmt >= electricAmt : (fields.electricPaid ?? false);
  const waterPaid = waterAmt != null && waterPaidAmt != null ? waterPaidAmt >= waterAmt : (fields.waterPaid ?? false);
  const otherPaid = otherAmt != null && otherPaidAmt != null ? otherPaidAmt >= otherAmt : (fields.otherPaid ?? false);

  const shared = {
    rentAmount, rentPaidAmount: rentPaidAmt, rentPaid,
    electricAmount: electricAmt, electricPaidAmount: electricPaidAmt, electricPaid,
    waterAmount: waterAmt, waterPaidAmount: waterPaidAmt, waterPaid,
    otherAmount: otherAmt, otherPaidAmount: otherPaidAmt, otherLabel: fields.otherLabel || null, otherPaid,
    balance, balancePaid,
    notes: fields.notes || null,
  };

  return prisma.monthlyLedger.upsert({
    where: { tenantId_month: { tenantId, month } },
    update: shared,
    create: { tenantId, month, ...shared },
  });
}
