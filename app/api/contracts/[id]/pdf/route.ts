import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contractInclude, contractPdf, pdfFilename } from "@/lib/contracts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return new Response("Unauthorized", { status: 401 });

  const contract = await prisma.contract.findFirst({ where: { id, accountId }, include: contractInclude });
  if (!contract) return new Response("Not found", { status: 404 });

  const pdf = await contractPdf(contract);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(contract)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
