import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody, str } from "@/lib/collections/http";
import { choosePage, disconnectPage, setupTemplates } from "@/lib/messenger/facebook";

export async function POST(req: Request) {
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    if (action === "choose") return choosePage(actor, str(body.requestId), str(body.pageId));
    if (action === "templates") return setupTemplates(actor);
    if (action === "disconnect") return disconnectPage(actor);
    throw invalid("Unknown action");
  });
}
