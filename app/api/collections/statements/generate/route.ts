import { handle, jsonBody, str } from "@/lib/collections/http";
import { generateStatements } from "@/lib/collections/statements";

export async function POST(req: Request) {
  return handle(async (actor) => {
    const body = await jsonBody(req);
    return generateStatements(actor, str(body.propertyId), str(body.periodKey));
  });
}
