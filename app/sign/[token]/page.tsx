import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, FileSignature } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SignForm } from "./sign-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign contract", robots: { index: false, follow: false } };

export default async function SignContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { signToken: token },
    include: { account: true, tenant: { include: { unit: { include: { property: true } } } } },
  });
  if (!contract || contract.status === "draft") notFound();

  if (contract.status === "sent" && !contract.viewedAt) {
    await prisma.contract.update({ where: { id: contract.id }, data: { viewedAt: new Date() } });
  }

  const signed = contract.status === "signed";
  const voided = contract.status === "void";

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <FileSignature className="h-5 w-5 text-blue-600" />
          <span className="font-semibold">{contract.account.name}</span>
          <span className="ml-auto text-xs text-gray-500">Secured by TenantHub</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {signed && (
          <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-green-800">Signed by both parties</p>
              <p className="text-green-700">A copy was emailed to everyone with an email on file.</p>
            </div>
            <a href={`/api/sign/${token}/pdf`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              <Download className="h-4 w-4" /> Download signed PDF
            </a>
          </div>
        )}
        {voided && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This contract was cancelled by {contract.account.ownerName} and can no longer be signed.
          </div>
        )}

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold sm:text-2xl">{contract.title}</h1>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-gray-500">Lessor: </dt><dd className="inline font-medium">{contract.account.ownerName}</dd></div>
            <div><dt className="inline text-gray-500">Lessee: </dt><dd className="inline font-medium">{contract.tenant.name}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-gray-500">Premises: </dt><dd className="inline font-medium">{contract.tenant.unit.property.name}, Unit {contract.tenant.unit.unitNumber}</dd></div>
            {(contract.startDate || contract.endDate) && (
              <div className="sm:col-span-2"><dt className="inline text-gray-500">Term: </dt><dd className="inline font-medium">{contract.startDate ? formatDate(contract.startDate) : "—"} to {contract.endDate ? formatDate(contract.endDate) : "—"}</dd></div>
            )}
            {contract.monthlyRent != null && <div><dt className="inline text-gray-500">Rent: </dt><dd className="inline font-medium">{formatCurrency(contract.monthlyRent)}/month</dd></div>}
            {contract.deposit != null && <div><dt className="inline text-gray-500">Deposit: </dt><dd className="inline font-medium">{formatCurrency(contract.deposit)}</dd></div>}
          </dl>
          <hr className="my-5 border-gray-200" />
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">{contract.body}</div>
          <hr className="my-5 border-gray-200" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { label: "Lessor (Owner)", sig: contract.ownerSignature, name: contract.ownerSignedName, at: contract.ownerSignedAt },
              { label: "Lessee (Tenant)", sig: contract.tenantSignature, name: contract.tenantSignedName, at: contract.tenantSignedAt },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex h-20 items-end border-b border-gray-800">
                  {s.sig ? <img src={s.sig} alt={`${s.label} signature`} className="max-h-20 max-w-full" /> : <span className="pb-2 text-sm text-gray-400">Not yet signed</span>}
                </div>
                <p className="mt-1 text-sm font-semibold">{s.name ?? "—"}</p>
                <p className="text-xs text-gray-500">{s.label}{s.at ? ` · ${formatDate(s.at)}` : ""}</p>
              </div>
            ))}
          </div>
        </article>

        {contract.status === "sent" && <SignForm token={token} defaultName={contract.tenant.name} />}
      </main>
    </div>
  );
}
