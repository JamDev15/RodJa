import { invalid } from "@/lib/collections/errors";
import { handle, jsonBody } from "@/lib/collections/http";
import { addOccupant } from "@/lib/operations/occupants";
import { addLeaseTerm } from "@/lib/operations/leases";
import { startChecklist } from "@/lib/operations/checklists";
import { applyDepositToCharges, receiveDeposit, releaseDeposit } from "@/lib/operations/deposits";
import { startMoveOut } from "@/lib/operations/moveout";

export async function POST(req: Request, ctx: RouteContext<"/api/operations/tenancies/[id]">) {
  const { id } = await ctx.params;
  return handle(async (actor) => {
    const { action, ...body } = await jsonBody(req);
    switch (action) {
      case "add_occupant":
        return addOccupant(actor, id, body);
      case "add_lease_term":
        return addLeaseTerm(actor, id, body);
      case "start_checklist":
        return startChecklist(actor, id, body.kind);
      case "receive_deposit":
        return receiveDeposit(actor, id, body);
      case "apply_deposit":
        return applyDepositToCharges(actor, id, body);
      case "release_deposit":
        return releaseDeposit(actor, id, body);
      case "start_moveout":
        return startMoveOut(actor, id, body);
      default:
        throw invalid("Unknown action");
    }
  });
}
