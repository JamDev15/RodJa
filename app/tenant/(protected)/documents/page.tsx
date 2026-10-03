import Link from "next/link";
import { FileSignature, FileText, ReceiptText, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function TenantDocumentsPage() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string;

  const [contracts, invoices] = await Promise.all([
    prisma.contract.findMany({
      where: { tenantId, status: { in: ["sent", "signed"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, signToken: true, tenantSignedAt: true, sentAt: true },
    }),
    prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, number: true, total: true, createdAt: true, token: true },
    }),
  ]);

  const toSign = contracts.filter((c) => c.status === "sent");

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold text-white">Documents</h1>
        <p className="text-gray-400 text-sm">Your contracts, invoices, and receipts</p>
      </div>

      {toSign.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-semibold text-yellow-300">
            {toSign.length === 1 ? "A contract needs your signature" : `${toSign.length} contracts need your signature`}
          </p>
          {toSign.map((c) => (
            <Link key={c.id} href={`/sign/${c.signToken}`} className="mt-2 flex items-center justify-between rounded-lg bg-yellow-500 px-4 py-3 text-sm font-semibold text-black">
              Review &amp; sign: {c.title}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-300">Contracts</h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-gray-500">No contracts yet.</p>
        ) : (
          contracts.map((c) => (
            <Link key={c.id} href={`/sign/${c.signToken}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
              <FileSignature className="h-5 w-5 text-blue-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {c.status === "signed" && c.tenantSignedAt ? `Signed ${formatDate(c.tenantSignedAt)}` : "Waiting for your signature"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500" />
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-300">Invoices &amp; receipts</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing yet.</p>
        ) : (
          invoices.map((inv) => {
            const Icon = inv.type === "invoice" ? FileText : ReceiptText;
            return (
              <Link key={inv.id} href={`/docs/${inv.token}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                <Icon className={`h-5 w-5 ${inv.type === "invoice" ? "text-blue-400" : "text-green-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{inv.type === "invoice" ? "Invoice" : "Receipt"} {inv.number}</p>
                  <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(inv.total)}</span>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
