import { createCaretaker } from "@/lib/collections/caretakers";
import { handle, jsonBody, str } from "@/lib/collections/http";

export async function POST(req: Request) {
  return handle(async (actor) => {
    const body = await jsonBody(req);
    return createCaretaker(actor, {
      name: str(body.name),
      email: str(body.email),
      password: str(body.password),
      propertyIds: Array.isArray(body.propertyIds) ? body.propertyIds.filter((x): x is string => typeof x === "string") : [],
    });
  }, 201);
}
