import { handle, jsonBody, str } from "@/lib/collections/http";
import { publishPeriod } from "@/lib/collections/statements";

/** Issue every draft of a period at once. */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const body = await jsonBody(req);
    const results = await publishPeriod(actor, str(body.propertyId), str(body.periodKey));
    return { published: results.filter((r) => !r.alreadyPublished).length };
  });
}
