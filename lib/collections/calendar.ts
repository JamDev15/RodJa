// Billing calendar. Dates here are calendar dates as "YYYY-MM-DD" strings in
// the property's time zone (Asia/Manila, UTC+8 all year — no DST), so a
// statement due "2026-11-15" is due on that Manila date regardless of where
// the server runs. Stored in Postgres DATE columns.

import { currentTime } from "./clock";

export type DateOnly = string; // "YYYY-MM-DD"
export type MonthKey = string; // "YYYY-MM"

export const SUPPORTED_TIMEZONES = ["Asia/Manila"] as const;
const OFFSET_MS: Record<string, number> = { "Asia/Manila": 8 * 60 * 60 * 1000 };

export type ShortMonthPolicy = "LAST_DAY" | "NEXT_MONTH_FIRST";

export interface CycleConfig {
  key: string;
  day: number; // 1-31
}

export interface ScheduleConfig {
  cycles: CycleConfig[];
  shortMonthPolicy: ShortMonthPolicy;
  generateDaysBefore: number;
  distributeDaysBefore: number;
  dueDaysAfter: number;
}

export function todayIn(timezone: string, now: Date = currentTime()): DateOnly {
  const offset = OFFSET_MS[timezone];
  if (offset == null) throw new Error(`Unsupported billing time zone: ${timezone}`);
  return new Date(now.getTime() + offset).toISOString().slice(0, 10);
}

export function monthOf(date: DateOnly): MonthKey {
  return date.slice(0, 7);
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: DateOnly, days: number): DateOnly {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** For Prisma @db.Date columns. */
export function toDbDate(date: DateOnly): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function fromDbDate(d: Date): DateOnly {
  return d.toISOString().slice(0, 10);
}

/** A Date (e.g. Tenant.moveInDate timestamp) as its calendar date in the zone. */
export function dateIn(timezone: string, d: Date): DateOnly {
  return todayIn(timezone, d);
}

/**
 * The calendar date a cycle falls on in a month. A configured day that the
 * month doesn't have (30 in February, 31 in April) follows the policy:
 * LAST_DAY → the month's last day; NEXT_MONTH_FIRST → the 1st of next month.
 */
export function resolveCycleDate(month: MonthKey, day: number, policy: ShortMonthPolicy): DateOnly {
  const last = daysInMonth(month);
  if (day <= last) return `${month}-${String(day).padStart(2, "0")}`;
  if (policy === "NEXT_MONTH_FIRST") return `${addMonths(month, 1)}-01`;
  return `${month}-${String(last).padStart(2, "0")}`;
}

export interface CycleOccurrence {
  key: string;
  month: MonthKey; // the billing month this cycle belongs to
  periodKey: string; // "2026-11-A"
  cycleDate: DateOnly;
  index: number; // position within the month (0-based)
  countInMonth: number;
}

export function validateCycles(cycles: CycleConfig[]): string | null {
  if (!Array.isArray(cycles) || cycles.length === 0) return "At least one billing cycle is required";
  if (cycles.length > 4) return "At most four billing cycles per month";
  const keys = new Set<string>();
  const days = new Set<number>();
  for (const c of cycles) {
    if (!/^[A-Z]$/.test(c.key)) return "Cycle keys must be single capital letters";
    if (!Number.isInteger(c.day) || c.day < 1 || c.day > 31) return "Cycle days must be between 1 and 31";
    if (keys.has(c.key)) return "Cycle keys must be unique";
    if (days.has(c.day)) return "Two cycles can't share the same day";
    keys.add(c.key);
    days.add(c.day);
  }
  return null;
}

/** Every cycle of a billing month, in date order. */
export function cyclesForMonth(cfg: Pick<ScheduleConfig, "cycles" | "shortMonthPolicy">, month: MonthKey): CycleOccurrence[] {
  const sorted = [...cfg.cycles].sort((a, b) => a.day - b.day);
  return sorted.map((c, index) => ({
    key: c.key,
    month,
    periodKey: `${month}-${c.key}`,
    cycleDate: resolveCycleDate(month, c.day, cfg.shortMonthPolicy),
    index,
    countInMonth: sorted.length,
  }));
}

export function parsePeriodKey(periodKey: string): { month: MonthKey; key: string } | null {
  const m = /^(\d{4}-\d{2})-([A-Z])$/.exec(periodKey);
  if (!m || !isValidMonth(m[1])) return null;
  return { month: m[1], key: m[2] };
}

export interface CycleSchedule extends CycleOccurrence {
  periodStart: DateOnly;
  periodEnd: DateOnly;
  generateOn: DateOnly;
  distributeOn: DateOnly;
  dueDate: DateOnly;
}

/**
 * Full schedule for one cycle. The service period runs from the cycle date
 * up to the day before the next cycle date. Statement generation,
 * distribution and the due date are separate dates, each configurable.
 */
export function cycleSchedule(cfg: ScheduleConfig, periodKey: string): CycleSchedule | null {
  const parsed = parsePeriodKey(periodKey);
  if (!parsed) return null;
  const occ = cyclesForMonth(cfg, parsed.month).find((c) => c.key === parsed.key);
  if (!occ) return null;
  const following = [...cyclesForMonth(cfg, parsed.month), ...cyclesForMonth(cfg, addMonths(parsed.month, 1))]
    .map((c) => c.cycleDate)
    .filter((d) => d > occ.cycleDate)
    .sort()[0];
  return {
    ...occ,
    periodStart: occ.cycleDate,
    periodEnd: addDays(following, -1),
    generateOn: addDays(occ.cycleDate, -cfg.generateDaysBefore),
    distributeOn: addDays(occ.cycleDate, -cfg.distributeDaysBefore),
    dueDate: addDays(occ.cycleDate, cfg.dueDaysAfter),
  };
}

/** Cycles whose generation date has arrived, looking a month either side. */
export function cyclesDueForGeneration(cfg: ScheduleConfig, today: DateOnly): CycleSchedule[] {
  const month = monthOf(today);
  return [addMonths(month, -1), month, addMonths(month, 1)]
    .flatMap((m) => cyclesForMonth(cfg, m))
    .map((c) => cycleSchedule(cfg, c.periodKey)!)
    .filter((s) => s.generateOn <= today && s.cycleDate >= addDays(today, -45));
}

export function formatDateOnly(date: DateOnly): string {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(toDbDate(date));
}

export function formatMonth(month: MonthKey): string {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", timeZone: "UTC" }).format(toDbDate(`${month}-01`));
}

export function formatPeriodLabel(s: { cycleDate: DateOnly; periodStart: DateOnly; periodEnd: DateOnly }): string {
  return `${formatDateOnly(s.periodStart)} – ${formatDateOnly(s.periodEnd)}`;
}
