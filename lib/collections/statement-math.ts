// Pure: the one formula for what a statement says. Used when a statement is
// published (snapshot) and by every screen that explains a balance.
//
//   total due = previous outstanding balance
//             + current charges + late penalties
//             − payments/credits already applied to this statement's lines
//             − unapplied credit
//
// "Previous outstanding balance" is debt already on the ledger from earlier
// charges, net of every approved payment allocated to them. It is shown, not
// re-charged, so it can never be counted twice.

import type { Centavos } from "./money";

export interface LineState {
  type: string;
  grossCentavos: Centavos; // as charged
  adjustmentsCentavos: Centavos; // waivers/reductions (≤ 0)
  allocatedCentavos: Centavos; // approved payments applied
}

export function netOf(l: LineState): Centavos {
  return l.grossCentavos + l.adjustmentsCentavos;
}

export function outstandingOf(l: LineState): Centavos {
  return Math.max(0, netOf(l) - l.allocatedCentavos);
}

export interface StatementTotals {
  previousBalanceCentavos: Centavos;
  currentChargesCentavos: Centavos;
  penaltiesCentavos: Centavos;
  adjustmentsCentavos: Centavos;
  appliedToThisStatementCentavos: Centavos;
  unappliedCreditCentavos: Centavos;
  totalDueCentavos: Centavos;
}

export function computeStatementTotals(input: {
  lines: LineState[]; // this statement's charges
  previousOutstandingCentavos: Centavos; // earlier charges, still unpaid
  unappliedCreditCentavos: Centavos; // approved money not allocated to anything
}): StatementTotals {
  const current = input.lines.filter((l) => l.type !== "PENALTY");
  const penalties = input.lines.filter((l) => l.type === "PENALTY");
  const currentChargesCentavos = current.reduce((s, l) => s + l.grossCentavos, 0);
  const penaltiesCentavos = penalties.reduce((s, l) => s + l.grossCentavos, 0);
  const adjustmentsCentavos = input.lines.reduce((s, l) => s + l.adjustmentsCentavos, 0);
  const appliedToThisStatementCentavos = input.lines.reduce((s, l) => s + Math.min(l.allocatedCentavos, Math.max(0, netOf(l))), 0);
  const totalDueCentavos =
    input.previousOutstandingCentavos +
    currentChargesCentavos +
    penaltiesCentavos +
    adjustmentsCentavos -
    appliedToThisStatementCentavos -
    input.unappliedCreditCentavos;
  return {
    previousBalanceCentavos: input.previousOutstandingCentavos,
    currentChargesCentavos,
    penaltiesCentavos,
    adjustmentsCentavos,
    appliedToThisStatementCentavos,
    unappliedCreditCentavos: input.unappliedCreditCentavos,
    totalDueCentavos,
  };
}

export type SettlementStatus = "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE" | "PARTIALLY_PAID_OVERDUE";

/** Settlement of a set of charges — independent of any payment's verification state. */
export function settlementStatus(lines: LineState[], dueDate: string, today: string): SettlementStatus {
  const net = lines.reduce((s, l) => s + Math.max(0, netOf(l)), 0);
  const outstanding = lines.reduce((s, l) => s + outstandingOf(l), 0);
  if (outstanding === 0) return "PAID";
  const overdue = today > dueDate;
  if (outstanding < net) return overdue ? "PARTIALLY_PAID_OVERDUE" : "PARTIALLY_PAID";
  return overdue ? "OVERDUE" : "UNPAID";
}
