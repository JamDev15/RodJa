import { getCurrentMonth, getMonthLabel, formatCurrency } from "@/lib/utils";

export interface TenantLite {
  id: string;
  name: string;
}

export type ActionKind = "add_bill" | "update_tenant" | "add_notice" | "add_maintenance";

export interface ProposedAction {
  kind: ActionKind;
  summary: string;
  // Shape matches the zod schema the API route re-validates against for `kind`.
  data: Record<string, unknown>;
}

export type ParseResult =
  | { type: "action"; reply: string; action: ProposedAction }
  | { type: "clarify"; reply: string; candidates: TenantLite[] }
  | { type: "unknown"; reply: string };

const UNKNOWN_REPLY =
  "I didn't catch that. Try things like \"add ₱500 electric bill for Juan this month\", " +
  "\"change Maria's phone to 0917...\", \"log a water leak for unit 2\", or \"notice: gate closed for repairs Friday\".";

// ─── Text helpers ────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function bigrams(s: string): Set<string> {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2));
  return grams;
}

// Dice coefficient — cheap, dependency-free fuzzy match, good enough for
// short tenant names typed with a typo or two.
function similarity(a: string, b: string): number {
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

interface TenantMatch {
  matched: TenantLite | null;
  candidates: TenantLite[];
}

function matchTenant(text: string, tenants: TenantLite[]): TenantMatch {
  if (tenants.length === 0) return { matched: null, candidates: [] };
  const lower = normalize(text);

  // 1. Exact full-name mention.
  const exact = tenants.filter((t) => lower.includes(t.name.toLowerCase()));
  if (exact.length === 1) return { matched: exact[0], candidates: [] };
  if (exact.length > 1) return { matched: null, candidates: exact };

  // 2. Whole-word match on any name part (first name, last name, etc).
  const wordHits = new Map<string, TenantLite>();
  for (const t of tenants) {
    const parts = t.name.split(/\s+/).filter((p) => p.length >= 3);
    for (const part of parts) {
      const re = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}\\b`, "i");
      if (re.test(lower)) {
        wordHits.set(t.id, t);
        break;
      }
    }
  }
  if (wordHits.size === 1) return { matched: [...wordHits.values()][0], candidates: [] };
  if (wordHits.size > 1) return { matched: null, candidates: [...wordHits.values()] };

  // 3. Fuzzy fallback against individual words in the message.
  const words = lower.split(/\s+/).filter((w) => w.length >= 3);
  const scored: { t: TenantLite; score: number }[] = [];
  for (const t of tenants) {
    let best = 0;
    for (const part of t.name.split(/\s+/)) {
      for (const w of words) best = Math.max(best, similarity(part, w));
    }
    if (best >= 0.6) scored.push({ t, score: best });
  }
  if (scored.length === 0) return { matched: null, candidates: [] };
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const ties = scored.filter((s) => top.score - s.score < 0.1);
  if (ties.length === 1) return { matched: top.t, candidates: [] };
  return { matched: null, candidates: ties.map((s) => s.t) };
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function extractMonth(text: string): string {
  const lower = normalize(text);

  const isoMatch = lower.match(/\b(20\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  if (/\bnext month\b/.test(lower)) {
    const [y, m] = getCurrentMonth().split("-").map(Number);
    const d = new Date(y, m, 1); // JS month is 0-indexed, so `m` here is already "next"
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (/\blast month\b/.test(lower)) {
    const [y, m] = getCurrentMonth().split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const name = MONTH_NAMES[i];
    // Trailing \b after the abbreviation stops "mar" from matching inside
    // an unrelated word like "Maria" — [a-z]* alone would happily eat the
    // rest of the name with no boundary check.
    const re = new RegExp(`\\b(?:${name}|${name.slice(0, 3)})\\b\\.?\\s*(\\d{4})?`, "i");
    const m = lower.match(re);
    if (m) {
      const year = m[1] ? Number(m[1]) : new Date().getFullYear();
      return `${year}-${String(i + 1).padStart(2, "0")}`;
    }
  }

  return getCurrentMonth();
}

function extractAmount(text: string): number | null {
  const currencyPrefixed = text.match(/(?:₱|php\s?)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyPrefixed) return Number(currencyPrefixed[1].replace(/,/g, ""));

  const currencySuffixed = text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:pesos?|php)\b/i);
  if (currencySuffixed) return Number(currencySuffixed[1].replace(/,/g, ""));

  // Strip ISO dates (YYYY-MM / YYYY-MM-DD) so a stated month/year doesn't
  // get mistaken for the bill amount when there's no currency marker.
  const withoutDates = text.replace(/\b20\d{2}-\d{2}(?:-\d{2})?\b/g, "");

  // Fallback: any standalone number with 2+ digits (word-boundary rules out
  // things like "tenant1" where the digit is glued to a letter).
  const bare = withoutDates.match(/\b(\d{2,3}(?:,\d{3})*(?:\.\d{1,2})?|\d{4,}(?:\.\d{1,2})?)\b/);
  if (bare) return Number(bare[1].replace(/,/g, ""));

  return null;
}

const BILL_TYPE_KEYWORDS: { type: "rent" | "electric" | "water"; words: string[] }[] = [
  { type: "rent", words: ["rent", "upa"] },
  { type: "electric", words: ["electric", "electricity", "kuryente", "meralco"] },
  { type: "water", words: ["water", "tubig", "maynilad", "manila water"] },
];

function extractBillType(text: string): { billType: "rent" | "electric" | "water" | "other"; otherLabel: string | null } {
  const lower = normalize(text);
  for (const { type, words } of BILL_TYPE_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return { billType: type, otherLabel: null };
  }
  // "internet bill", "association due", etc — grab the word right before "bill"/"due" if present.
  const labelMatch = lower.match(/(\w+)\s+(?:bill|due|fee|charge)\b/);
  if (labelMatch && !["the", "a", "an", "monthly"].includes(labelMatch[1])) {
    return { billType: "other", otherLabel: labelMatch[1][0].toUpperCase() + labelMatch[1].slice(1) };
  }
  return { billType: "other", otherLabel: "Other" };
}

const MAINTENANCE_KEYWORDS = [
  "repair", "broken", "not working", "leak", "leaking", "maintenance",
  "fix", "ayusin", "sira", "walang tubig", "walang kuryente", "clogged", "busted",
];
const NOTICE_KEYWORDS = ["notice", "announce", "announcement", "remind everyone", "tell all tenants", "tell everyone", "message to tenant"];

interface FieldExtraction {
  field: string;
  value: unknown;
  label: string;
}

function extractTenantField(text: string): FieldExtraction | null {
  const lower = normalize(text);

  if (/\bphone|\bnumber|\bcontact\b|\bcell\b/.test(lower)) {
    const phone = text.match(/(\+?\d[\d\s-]{6,}\d)/);
    if (phone) return { field: "phone", value: phone[1].replace(/[\s-]/g, ""), label: "phone number" };
  }
  if (/\bemail\b/.test(lower)) {
    const email = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (email) return { field: "email", value: email[0], label: "email" };
  }
  if (/\bmove[\s-]?out|\bvacat|\bleaving\b/.test(lower)) {
    const dateStr = extractDateString(text);
    if (dateStr) return { field: "moveOutDate", value: dateStr, label: "move-out date" };
  }
  if (/\bdeposit\b/.test(lower)) {
    const paid = /\bnot\s+paid|\bunpaid\b/.test(lower) ? false : /\bpaid\b/.test(lower) ? true : null;
    if (paid !== null) return { field: "depositPaid", value: paid, label: "deposit paid status" };
  }
  if (/\bdue day|\bdue date\b/.test(lower)) {
    const day = lower.match(/\bdue (?:day|date)\D{0,5}(\d{1,2})\b/);
    if (day) return { field: "dueDay", value: Number(day[1]), label: "due day" };
  }
  if (/\bnote\b/.test(lower)) {
    const note = text.match(/note[s]?:?\s*(.+)$/i);
    if (note) return { field: "notes", value: note[1].trim(), label: "notes" };
  }
  if (/\bdeactivate|\bmark inactive|\bmoved out\b|\bhas left\b/.test(lower)) {
    return { field: "isActive", value: false, label: "active status" };
  }
  if (/\breactivate|\bmark active\b/.test(lower)) {
    return { field: "isActive", value: true, label: "active status" };
  }
  return null;
}

function extractDateString(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const name = MONTH_NAMES[i];
    const re = new RegExp(`\\b(?:${name}|${name.slice(0, 3)})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "i");
    const m = text.match(re);
    if (m) {
      const year = m[2] ? Number(m[2]) : new Date().getFullYear();
      const day = Number(m[1]);
      return `${year}-${String(i + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

// ─── Main entry point ────────────────────────────────────────────────────

export function parseMessage(rawText: string, tenants: TenantLite[], tenantIdHint?: string): ParseResult {
  const text = rawText.trim();
  if (!text) return { type: "unknown", reply: UNKNOWN_REPLY };
  const lower = normalize(text);

  const amount = extractAmount(text);
  // "due" alone counts as a bill signal ("amount due 500"), but not when
  // it's actually "due day"/"due date" — that's the tenant-field update.
  const hasBillKeyword =
    /\bbill\b|\bcharge\b|\bfee\b/.test(lower) ||
    (/\bdue\b/.test(lower) && !/\bdue\s+(?:day|date)\b/.test(lower)) ||
    BILL_TYPE_KEYWORDS.some((g) => g.words.some((w) => lower.includes(w)));
  const isMaintenance = MAINTENANCE_KEYWORDS.some((w) => lower.includes(w));
  // Explicit "notice:"/"announce" phrasing wins over incidental overlap with
  // maintenance words (e.g. a notice mentioning "repairs").
  const isNotice = NOTICE_KEYWORDS.some((w) => lower.includes(w));

  function resolveTenant(): { matched: TenantLite | null; candidates: TenantLite[] } {
    if (tenantIdHint) {
      const hinted = tenants.find((t) => t.id === tenantIdHint);
      if (hinted) return { matched: hinted, candidates: [] };
    }
    return matchTenant(text, tenants);
  }

  // Bills need an amount; that's what separates "electric bill" from a
  // maintenance complaint that happens to mention "water".
  if (amount != null && hasBillKeyword && !isMaintenance) {
    const { matched, candidates } = resolveTenant();
    if (!matched) {
      if (candidates.length > 0) return { type: "clarify", reply: "I found more than one tenant that could match — which one?", candidates };
      return { type: "unknown", reply: "Which tenant is this bill for? Include their name, e.g. \"add ₱500 electric bill for Juan\"." };
    }
    const { billType, otherLabel } = extractBillType(text);
    const month = extractMonth(text);
    const label = billType === "other" ? otherLabel ?? "Other" : billType[0].toUpperCase() + billType.slice(1);
    const summary = `Add ${formatCurrency(amount)} ${label} bill for **${matched.name}** — ${getMonthLabel(month)}`;
    return {
      type: "action",
      reply: summary,
      action: {
        kind: "add_bill",
        summary,
        data: { tenantId: matched.id, month, billType, amount, otherLabel },
      },
    };
  }

  if (isNotice) {
    const { matched, candidates } = resolveTenant();
    // Unlike the other intents, "no tenant mentioned" is a valid broadcast case here.
    if (candidates.length > 0) return { type: "clarify", reply: "Is this notice for a specific tenant? Which one?", candidates };
    const title = text.length > 60 ? text.slice(0, 57) + "..." : text;
    const who = matched ? `**${matched.name}**` : "all tenants";
    const summary = `Post notice to ${who}: "${title}"`;
    return {
      type: "action",
      reply: summary,
      action: {
        kind: "add_notice",
        summary,
        data: { tenantId: matched ? matched.id : null, title, content: text, type: "general" },
      },
    };
  }

  if (isMaintenance) {
    const { matched, candidates } = resolveTenant();
    if (!matched) {
      if (candidates.length > 0) return { type: "clarify", reply: "Which tenant is this maintenance request for?", candidates };
      return { type: "unknown", reply: "Which tenant/unit is this maintenance issue for?" };
    }
    const priority = /\burgent|\basap|\bemergency\b/.test(lower) ? "urgent" : /\bhigh priority\b/.test(lower) ? "high" : "normal";
    const title = text.length > 60 ? text.slice(0, 57) + "..." : text;
    const summary = `Log a ${priority} maintenance request for **${matched.name}**: "${title}"`;
    return {
      type: "action",
      reply: summary,
      action: {
        kind: "add_maintenance",
        summary,
        data: { tenantId: matched.id, title, description: text, priority },
      },
    };
  }

  // Update intent is driven directly by whether a recognizable field+value
  // shows up (phone, email, a date, "deposit paid", "deactivate", etc) —
  // a fixed verb list ("change"/"update"/"set") missed plain phrasing like
  // "Maria moved out, deactivate her".
  const field = extractTenantField(text);
  if (field) {
    const { matched, candidates } = resolveTenant();
    if (!matched) {
      if (candidates.length > 0) return { type: "clarify", reply: "Which tenant do you want to update?", candidates };
      return { type: "unknown", reply: "Which tenant do you want to update?" };
    }
    const displayValue = typeof field.value === "boolean" ? (field.value ? "yes" : "no") : String(field.value);
    const summary = `Update **${matched.name}**'s ${field.label} to "${displayValue}"`;
    return {
      type: "action",
      reply: summary,
      action: {
        kind: "update_tenant",
        summary,
        data: { tenantId: matched.id, [field.field]: field.value },
      },
    };
  }

  return { type: "unknown", reply: UNKNOWN_REPLY };
}
