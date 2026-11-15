// Pure: whether a late penalty applies to an issued statement, and how much.
//
// Rules implemented (each configurable, all off by default):
//  - penalties only when enabled AND a rate AND a grace period are set
//    (grace may be 0, but it must be set deliberately);
//  - basis = the statement's own charges still unpaid, EXCLUDING earlier
//    penalties and carried balances (no compounding, no double counting);
//  - assessed once per statement (penaltyRepeat "ONCE"); the charge's
//    sourceKey "penalty:<statementId>" makes reruns harmless;
//  - per-tenant exemptions skip assessment entirely.

import { applyBasisPoints, type Centavos } from "./money";
import { addDays, type DateOnly } from "./calendar";

export interface PenaltyConfig {
  penaltyEnabled: boolean;
  penaltyRateBps: number | null;
  penaltyGraceDays: number | null;
  penaltyRepeat: string;
  penaltyBasis: string;
}

export function penaltyConfigProblem(cfg: PenaltyConfig): string | null {
  if (!cfg.penaltyEnabled) return "Late penalties are turned off";
  if (cfg.penaltyRateBps == null || cfg.penaltyRateBps <= 0) return "No penalty percentage is set";
  if (cfg.penaltyRateBps > 10000) return "Penalty percentage can't exceed 100%";
  if (cfg.penaltyGraceDays == null || cfg.penaltyGraceDays < 0) return "No grace period is set";
  if (cfg.penaltyRepeat !== "ONCE") return "Only one penalty per statement is supported until a repeat rule is confirmed";
  if (cfg.penaltyBasis !== "STATEMENT_UNPAID_CHARGES") return "Unsupported penalty basis";
  return null;
}

export interface PenaltyCandidate {
  statementId: string;
  dueDate: DateOnly;
  unpaidNonPenaltyCentavos: Centavos;
  tenantExempt: boolean;
}

export type PenaltyDecision =
  | { apply: true; amountCentavos: Centavos; sourceKey: string; calc: Record<string, unknown> }
  | { apply: false; reason: string };

export function assessPenalty(cfg: PenaltyConfig, c: PenaltyCandidate, today: DateOnly): PenaltyDecision {
  const problem = penaltyConfigProblem(cfg);
  if (problem) return { apply: false, reason: problem };
  if (c.tenantExempt) return { apply: false, reason: "Tenant is exempt from penalties" };
  const lateAfter = addDays(c.dueDate, cfg.penaltyGraceDays!);
  if (today <= lateAfter) return { apply: false, reason: "Still within the grace period" };
  if (c.unpaidNonPenaltyCentavos <= 0) return { apply: false, reason: "Nothing unpaid on this statement" };
  const amount = applyBasisPoints(c.unpaidNonPenaltyCentavos, cfg.penaltyRateBps!);
  if (amount <= 0) return { apply: false, reason: "Penalty rounds to zero" };
  return {
    apply: true,
    amountCentavos: amount,
    sourceKey: `penalty:${c.statementId}`,
    calc: { rateBps: cfg.penaltyRateBps, graceDays: cfg.penaltyGraceDays, basisCentavos: c.unpaidNonPenaltyCentavos, dueDate: c.dueDate, assessedOn: today },
  };
}
