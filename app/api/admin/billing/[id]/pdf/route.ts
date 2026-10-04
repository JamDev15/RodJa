import { requireSuperAdmin } from "@/lib/admin-auth";
import { subscriptionPdfResponse } from "@/lib/subscription-pdf-response";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const { id } = await params;
  return subscriptionPdfResponse(req, id);
}
