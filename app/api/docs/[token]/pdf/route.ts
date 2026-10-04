import { prisma } from "@/lib/prisma";
import { invoicePdf } from "@/lib/invoices";

/** Tenant-facing PDF for an emailed invoice/receipt link (token = credential). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { token },
    include: { account: true, tenant: { include: { unit: { include: { property: true } } } } },
  });
  if (!inv) return new Response("Not found", { status: 404 });

  const pdf = await invoicePdf(inv, inv.account, inv.tenant);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
