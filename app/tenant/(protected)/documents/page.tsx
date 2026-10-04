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
        <h1 className="text-xl font-bold text-th-ink">Documents</h1>
        <p className="text-th-muted text-sm">Your contracts, invoices, and receipts</p>
      </div>

      {toSign.length > 0 && (
        <div className="rounded-xl border border-th-due/30 bg-th-due-soft p-4">
          <p className="text-sm font-semibold text-th-due">
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
        <h2 className="text-sm font-semibold text-th-ink/80">Contracts</h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-th-faint">No contracts yet.</p>
        ) : (
          contracts.map((c) => (
            <Link key={c.id} href={`/sign/${c.signToken}`} className="flex items-center gap-3 rounded-xl border border-th-line bg-th-surface p-4 hover:bg-th-raised">
              <FileSignature className="h-5 w-5 text-th-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-th-ink">{c.title}</p>
                <p className="text-xs text-th-faint">
                  {c.status === "signed" && c.tenantSignedAt ? `Signed ${formatDate(c.tenantSignedAt)}` : "Waiting for your signature"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-th-faint" />
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-th-ink/80">Invoices &amp; receipts</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-th-faint">Nothing yet.</p>
        ) : (
          invoices.map((inv) => {
            const Icon = inv.type === "invoice" ? FileText : ReceiptText;
            return (
              <Link key={inv.id} href={`/docs/${inv.token}`} className="flex items-center gap-3 rounded-xl border border-th-line bg-th-surface p-4 hover:bg-th-raised">
                <Icon className={`h-5 w-5 ${inv.type === "invoice" ? "text-th-accent" : "text-th-paid"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-th-ink">{inv.type === "invoice" ? "Invoice" : "Receipt"} {inv.number}</p>
                  <p className="text-xs text-th-faint">{formatDate(inv.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold text-th-ink">{formatCurrency(inv.total)}</span>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
