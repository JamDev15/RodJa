import { handle, jsonBody } from "@/lib/collections/http";
import { saveTemplate } from "@/lib/operations/checklists";

export async function POST(req: Request) {
  return handle(async (actor) => saveTemplate(actor, await jsonBody(req)));
}
