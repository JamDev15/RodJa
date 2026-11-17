// Shared helpers for Phase 3 (expenses, utilities, petty cash, reports).
// Everything here is office-only: administrators of the account. Caretakers
// may only enter building meter readings (lib/finance/utilities.ts).

import { adminProperty, type Actor } from "@/lib/collections/actor";
import { addDays, isValidMonth, monthsBetween, type DateOnly, type MonthKey } from "@/lib/collections/calendar";
import { invalid } from "@/lib/collections/errors";
import { parsePesos } from "@/lib/collections/money";

export const EXPENSE_CATEGORIES = {
  REPAIRS_MAINTENANCE: "Repairs and maintenance",
  UTILITIES_WATER: "Water (building)",
  UTILITIES_ELECTRICITY: "Electricity (common areas)",
  SUPPLIES: "Supplies",
  CLEANING: "Cleaning",
  SECURITY: "Security",
  SALARIES: "Salaries and wages",
  INTERNET: "Internet (building)",
  TAXES_PERMITS: "Taxes, permits and fees",
  INSURANCE: "Insurance",
  OTHER: "Other",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export function parseCategory(v: unknown): ExpenseCategory {
  if (typeof v === "string" && v in EXPENSE_CATEGORIES) return v as ExpenseCategory;
  throw invalid("Choose a category");
}

export const PAY_METHODS = ["cash", "gcash", "maya", "bank", "check", "petty_cash", "other"] as const;

export function parseMethod(v: unknown): string | null {
  if (v == null || v === "") return null;
  if ((PAY_METHODS as readonly unknown[]).includes(v)) return v as string;
  throw invalid("Unknown payment method");
}

/** Amount from JSON centavos (amountCentavos) or a pesos text field (amount, from multipart forms). */
export function amountFrom(input: { amountCentavos?: unknown; amount?: unknown }, label = "Amount"): number {
  let c: number | null = null;
  if (input.amountCentavos != null && input.amountCentavos !== "") c = typeof input.amountCentavos === "number" ? input.amountCentavos : Number(input.amountCentavos);
  else if (input.amount != null && input.amount !== "") c = parsePesos(String(input.amount));
  if (c == null || !Number.isInteger(c) || c <= 0) throw invalid(`${label} must be more than zero`);
  if (c > 100_000_000_00) throw invalid(`${label} is too large`);
  return c;
}

export async function requireProperty(actor: Actor | null, propertyId: unknown) {
  return adminProperty(actor, String(propertyId ?? ""));
}

/** Inclusive month range, max 24 months. */
export function monthRange(from: unknown, to: unknown): MonthKey[] {
  if (typeof from !== "string" || !isValidMonth(from) || typeof to !== "string" || !isValidMonth(to)) throw invalid("Choose months as YYYY-MM");
  if (to < from) throw invalid("The end month is before the start month");
  const n = monthsBetween(from, to);
  if (n > 23) throw invalid("Choose at most 24 months");
  const out: MonthKey[] = [];
  let [y, m] = from.split("-").map(Number);
  for (let i = 0; i <= n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}` as MonthKey);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function monthStart(m: MonthKey): DateOnly {
  return `${m}-01`;
}

export function monthEnd(m: MonthKey): DateOnly {
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}
