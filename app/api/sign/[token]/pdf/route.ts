import { prisma } from "@/lib/prisma";
import { contractInclude, contractPdf, pdfFilename } from "@/lib/contracts";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({ where: { signToken: token }, include: contractInclude });
  if (!contract || contract.status === "void" || contract.status === "draft") return new Response("Not found", { status: 404 });

  const pdf = await contractPdf(contract);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(contract)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
