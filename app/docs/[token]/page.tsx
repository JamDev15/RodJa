import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/utils";
import type { InvoiceItem } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing document", robots: { index: false, follow: false } };

export default async function DocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { token },
    include: { account: true, tenant: { include: { unit: { include: { property: true } } } } },
  });
  if (!inv) notFound();

  const isInvoice = inv.type === "invoice";
  const items = (inv.items as InvoiceItem[]) ?? [];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold">{inv.account.name}</p>
            <p className="text-sm text-gray-500">{inv.account.ownerName}</p>
            <p className="text-sm text-gray-500">{inv.account.email}</p>
          </div>
          <div className="sm:text-right">
            <p className={`text-2xl font-bold ${isInvoice ? "text-blue-600" : "text-green-600"}`}>{isInvoice ? "INVOICE" : "RECEIPT"}</p>
            <p className="text-sm text-gray-600">No. {inv.number}</p>
            <p className="text-sm text-gray-600">{isInvoice ? "Issued" : "Paid"} {formatDate(inv.createdAt)}</p>
            {isInvoice && inv.dueDate && <p className="text-sm font-medium text-gray-800">Due {formatDate(inv.dueDate)}</p>}
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{isInvoice ? "Bill to" : "Received from"}</p>
          <p className="font-semibold">{inv.tenant.name}</p>
          <p className="text-gray-600">{inv.tenant.unit.property.name}, Unit {inv.tenant.unit.unitNumber}</p>
          {inv.month && <p className="mt-2 text-gray-600">Billing period: {getMonthLabel(inv.month)}</p>}
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="px-3 py-2">{i.label}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(i.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-3 text-right font-semibold">{isInvoice ? "Total due" : "Amount received"}</td>
              <td className="px-3 py-3 text-right text-lg font-bold">{formatCurrency(inv.total)}</td>
            </tr>
          </tbody>
        </table>

        {isInvoice && (inv.account.gcashNumber || inv.account.mayaNumber || inv.account.bankDetails) && (
          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm">
            <p className="font-semibold text-blue-900">How to pay</p>
            {inv.account.gcashNumber && <p>GCash: <strong>{inv.account.gcashNumber}</strong></p>}
            {inv.account.mayaNumber && <p>Maya: <strong>{inv.account.mayaNumber}</strong></p>}
            {inv.account.bankDetails && <p>Bank: <strong>{inv.account.bankDetails}</strong></p>}
            <p className="mt-1 text-blue-800">After paying, upload your proof in the tenant portal.</p>
          </div>
        )}
        {!isInvoice && <p className="mt-4 text-center text-lg font-bold text-green-600">PAID — Thank you!</p>}
        {inv.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-600">{inv.notes}</p>}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <a href={`/api/docs/${token}/pdf`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
            <Download className="h-4 w-4" /> Download PDF
          </a>
          {isInvoice && (
            <a href="/tenant/login" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">
              Open tenant portal to pay
            </a>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">Generated with TenantHub</p>
    </div>
  );
}
