import { handle, jsonBody } from "@/lib/collections/http";
import { postAnnouncement } from "@/lib/operations/announcements";

export async function POST(req: Request) {
  return handle(async (actor) => postAnnouncement(actor, await jsonBody(req)), 201);
}
