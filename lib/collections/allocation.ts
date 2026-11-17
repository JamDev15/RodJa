// Pure: apply money to outstanding charges, oldest first.

import type { Centavos } from "./money";

export interface OpenCharge {
  id: string;
  dueDate: string; // "YYYY-MM-DD"
  createdAt: Date;
  outstandingCentavos: Centavos;
}

export interface Allocation {
  chargeId: string;
  amountCentavos: Centavos;
}

/** Oldest due date first; ties by creation time, then id, so order is stable. */
export function sortOldestFirst<T extends OpenCharge>(charges: T[]): T[] {
  return [...charges].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}

export function allocateOldestFirst(charges: OpenCharge[], amount: Centavos): { allocations: Allocation[]; remainingCentavos: Centavos } {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Allocation amount must be a non-negative integer of centavos");
  let remaining = amount;
  const allocations: Allocation[] = [];
  for (const c of sortOldestFirst(charges)) {
    if (remaining === 0) break;
    if (c.outstandingCentavos <= 0) continue;
    const take = Math.min(remaining, c.outstandingCentavos);
    allocations.push({ chargeId: c.id, amountCentavos: take });
    remaining -= take;
  }
  return { allocations, remainingCentavos: remaining };
}
