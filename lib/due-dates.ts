const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toPhDateOnly(date: Date): Date {
  const ph = new Date(date.getTime() + PH_OFFSET_MS);
  return new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate()));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((toPhDateOnly(a).getTime() - toPhDateOnly(b).getTime()) / 86400000);
}

export function monthKeyOf(date: Date): string {
  const ph = new Date(date.getTime() + PH_OFFSET_MS);
  return `${ph.getUTCFullYear()}-${String(ph.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Due date for a given month, using the tenant's configured due day
// (Tenant.dueDay, 1-28). Used directly for computing this month's due date,
// and as the fallback when no Payment row exists yet for that month.
export function dueDateForMonth(monthKey: string, dueDay: number = 5): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dueDay));
}
