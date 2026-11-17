// Pure: which charges belong on one tenant's statement for one cycle.
// Every planned charge carries a sourceKey that is unique per tenant, so the
// database (Charge @@unique([tenantId, sourceKey])) rejects a second copy no
// matter how many times generation is retried or run concurrently.

import type { Centavos } from "./money";
import { monthsBetween, type CycleOccurrence, type DateOnly, type MonthKey } from "./calendar";

export type ChargeType =
  | "RENT"
  | "INTERNET"
  | "WATER"
  | "WATER_EXCESS"
  | "PARKING"
  | "MISC"
  | "PENALTY"
  | "OPENING_BALANCE"
  | "DAMAGE"
  | "OTHER";

export const CHARGE_LABELS: Record<ChargeType, string> = {
  RENT: "Rent",
  INTERNET: "Internet",
  WATER: "Water",
  WATER_EXCESS: "Water excess usage",
  PARKING: "Parking",
  MISC: "Miscellaneous",
  PENALTY: "Late penalty",
  OPENING_BALANCE: "Opening balance",
  DAMAGE: "Damages (move-out)",
  OTHER: "Other recurring",
};

export interface RecurringChargeInput {
  id: string;
  type: "RENT" | "INTERNET" | "PARKING" | "OTHER";
  description: string;
  amountCentavos: Centavos;
  amountBasis: "PER_OCCURRENCE" | "PER_CYCLE" | "MONTHLY_SPLIT";
  frequency: "EVERY_CYCLE" | "MONTHLY" | "EVERY_N_MONTHS";
  intervalMonths: number;
  cycleKey: string | null;
  startMonth: MonthKey;
  endMonth: MonthKey | null;
  isActive: boolean;
}

export interface WaterConfig {
  waterEnabled: boolean;
  waterBaseCentavos: Centavos;
  waterPerExtraCentavos: Centavos;
  waterMaxOccupants: number;
}

export interface PlanInput {
  cycle: CycleOccurrence;
  monthlyCycleKey: string;
  recurring: RecurringChargeInput[];
  water: WaterConfig;
  occupantCount: number | null;
  waterOverride: { amountCentavos: Centavos; reason: string } | null;
  /**
   * Partial cycles. DAILY prorates every-cycle rent by the days the tenancy
   * covers within [periodStart, periodEnd]; NONE (default) bills it in full.
   */
  proration?: { policy: "NONE" | "DAILY"; periodStart: DateOnly; periodEnd: DateOnly; occupiedFrom: DateOnly; occupiedTo: DateOnly | null };
}

function dayNumber(d: DateOnly): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Days the tenancy covers in the period (inclusive), and the period length. */
export function occupiedDays(p: { periodStart: DateOnly; periodEnd: DateOnly; occupiedFrom: DateOnly; occupiedTo: DateOnly | null }): { occupied: number; total: number } {
  const total = dayNumber(p.periodEnd) - dayNumber(p.periodStart) + 1;
  const from = Math.max(dayNumber(p.periodStart), dayNumber(p.occupiedFrom));
  const to = Math.min(dayNumber(p.periodEnd), p.occupiedTo ? dayNumber(p.occupiedTo) : Infinity);
  return { occupied: Math.max(0, to - from + 1), total };
}

export interface PlannedCharge {
  type: ChargeType;
  description: string;
  amountCentavos: Centavos;
  sourceKey: string;
  sourceId: string | null;
  calc: Record<string, unknown> | null;
}

export interface PlanResult {
  charges: PlannedCharge[];
  notes: string[];
}

/**
 * Occupant-based water: base + perExtra × (occupants − 1).
 * 1 → ₱350, 2 → ₱550, 3 → ₱750, 4 → ₱950 with the Dawson defaults.
 */
export function occupantWaterCharge(occupants: number | null | undefined, cfg: WaterConfig): { amountCentavos: Centavos } | { error: string } {
  if (occupants == null) return { error: "No occupant count recorded" };
  if (!Number.isInteger(occupants) || occupants < 1) return { error: "Occupant count must be at least 1" };
  if (occupants > cfg.waterMaxOccupants) return { error: `More than ${cfg.waterMaxOccupants} occupants is not allowed` };
  return { amountCentavos: cfg.waterBaseCentavos + cfg.waterPerExtraCentavos * (occupants - 1) };
}

function activeInMonth(rc: RecurringChargeInput, month: MonthKey): boolean {
  if (!rc.isActive) return false;
  if (month < rc.startMonth) return false;
  if (rc.endMonth && month > rc.endMonth) return false;
  return true;
}

/** Split a monthly amount across n cycles; the last cycle takes the leftover centavos. */
export function splitAcrossCycles(monthly: Centavos, index: number, count: number): Centavos {
  const base = Math.floor(monthly / count);
  return index === count - 1 ? monthly - base * (count - 1) : base;
}

export function planCycleCharges(input: PlanInput): PlanResult {
  const { cycle } = input;
  const month = cycle.month;
  const charges: PlannedCharge[] = [];
  const notes: string[] = [];

  for (const rc of input.recurring) {
    if (!activeInMonth(rc, month)) continue;
    const carrierKey = rc.cycleKey ?? input.monthlyCycleKey;

    if (rc.type === "RENT" && rc.amountBasis !== "PER_CYCLE" && rc.amountBasis !== "MONTHLY_SPLIT") {
      // Never guess whether a rent amount is monthly or per installment.
      notes.push(`Rent "${rc.description}" skipped: choose whether the amount is per cycle or monthly`);
      continue;
    }

    if (rc.frequency === "EVERY_CYCLE") {
      let amount = rc.amountCentavos;
      let calc: Record<string, unknown> | null = null;
      if (rc.type === "RENT" && rc.amountBasis === "MONTHLY_SPLIT") {
        amount = splitAcrossCycles(rc.amountCentavos, cycle.index, cycle.countInMonth);
        calc = { basis: "MONTHLY_SPLIT", monthlyCentavos: rc.amountCentavos, cycles: cycle.countInMonth };
      } else if (rc.type === "RENT") {
        calc = { basis: "PER_CYCLE" };
      }
      if (rc.type === "RENT" && input.proration?.policy === "DAILY") {
        const { occupied, total } = occupiedDays(input.proration);
        if (occupied < total) {
          const full = amount;
          // Round half up to the centavo; the formula is kept on the charge.
          amount = Math.round((full * occupied) / total);
          calc = { ...(calc ?? {}), prorated: true, fullCentavos: full, occupiedDays: occupied, periodDays: total };
          notes.push(`Rent prorated: ${occupied} of ${total} days`);
        }
      }
      if (amount > 0) {
        charges.push({ type: rc.type, description: rc.description, amountCentavos: amount, sourceKey: `rc:${rc.id}:${cycle.periodKey}`, sourceId: rc.id, calc });
      }
      continue;
    }

    // Monthly and every-N-months items: one cycle per month carries them,
    // keyed by month (not period) so they can't be billed twice in a month
    // even if the cycle settings change mid-month.
    if (cycle.key !== carrierKey) continue;
    if (rc.frequency === "EVERY_N_MONTHS") {
      const interval = Math.max(1, rc.intervalMonths);
      if (monthsBetween(rc.startMonth, month) % interval !== 0) continue;
    }
    if (rc.amountCentavos > 0) {
      charges.push({
        type: rc.type,
        description: rc.description,
        amountCentavos: rc.amountCentavos,
        sourceKey: `rc:${rc.id}:${month}`,
        sourceId: rc.id,
        calc: rc.frequency === "EVERY_N_MONTHS" ? { everyMonths: rc.intervalMonths } : null,
      });
    }
  }

  if (input.water.waterEnabled && cycle.key === input.monthlyCycleKey) {
    if (input.waterOverride) {
      charges.push({
        type: "WATER",
        description: "Water",
        amountCentavos: input.waterOverride.amountCentavos,
        sourceKey: `water:${month}`,
        sourceId: null,
        calc: { override: true, reason: input.waterOverride.reason, occupants: input.occupantCount },
      });
    } else {
      const w = occupantWaterCharge(input.occupantCount, input.water);
      if ("error" in w) {
        notes.push(`Water not charged: ${w.error}`);
      } else {
        charges.push({
          type: "WATER",
          description: `Water (${input.occupantCount} occupant${input.occupantCount === 1 ? "" : "s"})`,
          amountCentavos: w.amountCentavos,
          sourceKey: `water:${month}`,
          sourceId: null,
          calc: { occupants: input.occupantCount, baseCentavos: input.water.waterBaseCentavos, perExtraCentavos: input.water.waterPerExtraCentavos },
        });
      }
    }
  }

  if (!charges.some((c) => c.type === "RENT")) notes.push("No rent is configured for this room for this cycle");
  return { charges, notes };
}
