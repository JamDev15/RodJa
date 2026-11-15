import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody, str } from "@/lib/collections/http";
import { upsertProfile, type ProfileUpdate } from "@/lib/collections/profile";

// Settings that may be cleared (set to null) from the form. Anything else
// left blank is ignored rather than wiped.
const NULLABLE = new Set(["penaltyRateBps", "penaltyGraceDays", "penaltyMaxRepeats", "meterAllowance", "meterExcessRateCentavos", "meterReadingFrequency", "paymentInstructions"]);

export async function POST(req: Request) {
  return handle(async (actor) => {
    const body = await jsonBody(req);
    const { propertyId, cycleDays, penaltyPercent, ...rest } = body;
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === null && !NULLABLE.has(k)) continue;
      update[k] = v;
    }
    if (typeof cycleDays === "string" && cycleDays.trim()) {
      const days = cycleDays.split(/[\s,]+/).filter(Boolean).map(Number);
      if (days.some((d) => !Number.isInteger(d))) throw invalid("Cycle days must be whole numbers, e.g. 15, 30");
      update.cycles = [...days].sort((a, b) => a - b).map((day, i) => ({ key: String.fromCharCode(65 + i), day }));
    }
    if (penaltyPercent !== undefined) {
      if (penaltyPercent === null || penaltyPercent === "") update.penaltyRateBps = null;
      else {
        const pct = Number(penaltyPercent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) throw invalid("Penalty percentage must be between 0 and 100");
        update.penaltyRateBps = Math.round(pct * 100);
      }
    }
    return upsertProfile(actor, str(propertyId), update as ProfileUpdate);
  });
}
