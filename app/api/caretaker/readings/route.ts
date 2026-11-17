import { handle, jsonBody, optStr, str } from "@/lib/collections/http";
import { addMeterReading } from "@/lib/collections/meters";

/** Caretaker or admin: record a water meter reading. */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const body = await jsonBody(req);
    const { reading, proposalId } = await addMeterReading(actor, {
      unitId: str(body.unitId),
      readingDate: str(body.readingDate),
      value: str(body.value),
      isMeterReset: body.isMeterReset === true,
      notes: optStr(body.notes),
    });
    // Caretakers get back only what they entered — no billing figures.
    return { id: reading.id, readingDate: str(body.readingDate), value: reading.value.toString(), usage: reading.usage?.toString() ?? null, overAllowance: reading.overAllowance, flagged: !!proposalId || reading.overAllowance };
  }, 201);
}
