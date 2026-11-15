// Pure: whether a late penalty applies to an issued statement, and how much.
//
// Rules implemented (each configurable, all off by default):
//  - penalties only when enabled AND a rate AND a grace period are set
//    (grace may be 0, but it must be set deliberately);
//  - basis = the statement's own charges still unpaid, EXCLUDING earlier
//    penalties and carried balances (no compounding, no double counting);
//  - assessed once per statement (penaltyRepeat "ONCE"), or once per later
//    cycle up to penaltyMaxRepeats ("EACH_CYCLE"). The first penalty's
//    sourceKey is "penalty:<statementId>"; repeats add ":<periodKey>" of the
//    statement that carries them, so reruns of the same cycle are harmless;
//  - per-tenant exemptions skip assessment entirely.

import { applyBasisPoints, type Centavos } from "./money";
import { addDays, type DateOnly } from "./calendar";

export interface PenaltyConfig {
  penaltyEnabled: boolean;
  penaltyRateBps: number | null;
  penaltyGraceDays: number | null;
  penaltyRepeat: string;
  penaltyBasis: string;
  penaltyMaxRepeats?: number | null;
}

export function penaltyConfigProblem(cfg: PenaltyConfig): string | null {
  if (!cfg.penaltyEnabled) return "Late penalties are turned off";
  if (cfg.penaltyRateBps == null || cfg.penaltyRateBps <= 0) return "No penalty percentage is set";
  if (cfg.penaltyRateBps > 10000) return "Penalty percentage can't exceed 100%";
  if (cfg.penaltyGraceDays == null || cfg.penaltyGraceDays < 0) return "No grace period is set";
  if (cfg.penaltyRepeat !== "ONCE" && cfg.penaltyRepeat !== "EACH_CYCLE") return "Unsupported repeat rule";
  if (cfg.penaltyRepeat === "EACH_CYCLE" && (cfg.penaltyMaxRepeats == null || cfg.penaltyMaxRepeats < 1)) return "Set how many penalties one statement can receive";
  if (cfg.penaltyBasis !== "STATEMENT_UNPAID_CHARGES") return "Unsupported penalty basis";
  return null;
}

export interface PenaltyCandidate {
  statementId: string;
  dueDate: DateOnly;
  unpaidNonPenaltyCentavos: Centavos;
  tenantExempt: boolean;
  /** Penalties already charged for this statement on OTHER cycles' statements. */
  priorPenalties?: number;
  /** Period of the draft that would carry the penalty. */
  carrierPeriodKey?: string;
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
  const prior = c.priorPenalties ?? 0;
  const limit = cfg.penaltyRepeat === "EACH_CYCLE" ? cfg.penaltyMaxRepeats! : 1;
  if (prior >= limit) return { apply: false, reason: limit === 1 ? "Already penalised once" : `Already penalised ${prior} times (limit ${limit})` };
  if (prior > 0 && !c.carrierPeriodKey) return { apply: false, reason: "Repeat penalties need the carrying cycle" };
  const amount = applyBasisPoints(c.unpaidNonPenaltyCentavos, cfg.penaltyRateBps!);
  if (amount <= 0) return { apply: false, reason: "Penalty rounds to zero" };
  return {
    apply: true,
    amountCentavos: amount,
    sourceKey: prior === 0 ? `penalty:${c.statementId}` : `penalty:${c.statementId}:${c.carrierPeriodKey}`,
    calc: { rateBps: cfg.penaltyRateBps, graceDays: cfg.penaltyGraceDays, basisCentavos: c.unpaidNonPenaltyCentavos, dueDate: c.dueDate, assessedOn: today, occurrence: prior + 1, repeat: cfg.penaltyRepeat },
  };
}
