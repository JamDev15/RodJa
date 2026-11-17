import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { addDamageCharge, addInspectionPhoto, approveVacancy, cancelMoveOut, recordFinalReading, recordInspection } from "@/lib/operations/moveout";
import { formFile } from "@/lib/operations/http";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/moveouts/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      return addInspectionPhoto(actor, id, formFile(await req.formData(), "file"));
    }
    const { action, ...body } = await jsonBody(req);
    switch (action) {
      case "inspection":
        return recordInspection(actor, id, body);
      case "final_reading":
        return recordFinalReading(actor, id, body);
      case "damage":
        return addDamageCharge(actor, id, body);
      case "approve":
        return approveVacancy(actor, id, body);
      case "cancel":
        return cancelMoveOut(actor, id, body.reason);
      default:
        throw invalid("Unknown action");
    }
  });
}
