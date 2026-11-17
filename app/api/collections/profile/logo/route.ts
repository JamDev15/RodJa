import { handle } from "@/lib/collections/http";
import { setLogo } from "@/lib/collections/profile";

/** Multipart: propertyId + logo (image). */
export async function POST(req: Request) {
  return handle(async (actor) => {
    const form = await req.formData();
    const logo = form.get("logo");
    return setLogo(actor, String(form.get("propertyId") ?? ""), logo instanceof File ? logo : null);
  });
}
