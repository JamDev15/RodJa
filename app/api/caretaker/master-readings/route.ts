import { handle, jsonBody } from "@/lib/collections/http";
import { addMasterReading } from "@/lib/finance/utilities";

/** Building meter reading (caretaker of the property, or the office). */
export async function POST(req: Request) {
  return handle(async (actor) => addMasterReading(actor, await jsonBody(req)), 201);
}
