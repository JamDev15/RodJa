// Money for collections billing is always integer centavos (₱1.00 = 100).
// Never do arithmetic on Float pesos here — parse user input as text.

export type Centavos = number;

/**
 * Parse a peso amount typed by a person ("1,234.5", "₱ 950", "3000.00")
 * into exact centavos. Returns null for anything that isn't a plain
 * non-negative amount with at most two decimal places.
 */
export function parsePesos(input: string | number | null | undefined): Centavos | null {
  if (input == null) return null;
  const text = typeof input === "number" ? (Number.isFinite(input) ? input.toFixed(2) : "") : String(input);
  const cleaned = text.replace(/[₱,\s]/g, "").replace(/^php/i, "");
  const m = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  return whole * 100 + frac;
}

const PHP = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCentavos(c: Centavos): string {
  // Format from an exact decimal string so no binary-float rounding leaks in.
  const neg = c < 0;
  const abs = Math.abs(c);
  const out = PHP.format(Number(`${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`));
  return neg ? `-${out}` : out;
}

/** Centavos as a plain decimal string for inputs ("1234.50"). */
export function centavosToInput(c: Centavos | null | undefined): string {
  if (c == null) return "";
  return `${Math.trunc(c / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
}

/**
 * Bridge for the existing Float peso columns (Unit.rentAmount, Payment.amount,
 * MonthlyLedger.*). Those are only ever whole or two-decimal peso values, so
 * rounding to the nearest centavo recovers the intended amount exactly.
 */
export function legacyPesosToCentavos(pesos: number | null | undefined): Centavos | null {
  if (pesos == null || !Number.isFinite(pesos)) return null;
  return Math.round(pesos * 100);
}

/** Display-only conversion for reusing peso-based document code (PDF/email). */
export function centavosToPesos(c: Centavos): number {
  return c / 100;
}

/** percentage in basis points (500 = 5%) of an amount, rounded half-up to the centavo. */
export function applyBasisPoints(amount: Centavos, bps: number): Centavos {
  return Math.floor((amount * bps + 5000) / 10000);
}

export function sum(values: Centavos[]): Centavos {
  return values.reduce((a, b) => a + b, 0);
}
