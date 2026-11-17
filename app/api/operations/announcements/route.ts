import { handle, jsonBody } from "@/lib/collections/http";
import { postAnnouncement } from "@/lib/operations/announcements";
import { announcementPosted } from "@/lib/messenger/events";

export async function POST(req: Request) {
  return handle(async (actor) => {
    const result = await postAnnouncement(actor, await jsonBody(req));
    const messenger = await announcementPosted(result.notice.id).catch(() => 0);
    return { ...result, messenger };
  }, 201);
}
