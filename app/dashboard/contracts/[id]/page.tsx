import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { signUrl } from "@/lib/contracts";
import { ContractEditor } from "../contract-editor";
import { loadTenantOptions } from "../tenant-options";
import { ContractStatusBadge } from "../status-badge";
import { ContractActions } from "./contract-actions";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(d);

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const contract = await prisma.contract.findFirst({
    where: { id, accountId },
    include: { account: true, tenant: { include: { unit: { include: { property: true } } } } },
  });
  if (!contract) notFound();

  const header = (
    <div className="flex items-start gap-3">
      <Link href="/dashboard/contracts" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-white">{contract.title}</h1>
        <p className="text-gray-400 text-sm">
          <Link href={`/dashboard/tenants/${contract.tenantId}`} className="hover:text-white">{contract.tenant.name}</Link>
          {" · "}{contract.tenant.unit.property.name} Unit {contract.tenant.unit.unitNumber}
        </p>
      </div>
      <ContractStatusBadge status={contract.status} />
    </div>
  );

  if (contract.status === "draft") {
    const tenants = await loadTenantOptions(accountId, contract.tenantId);
    const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    return (
      <div className="space-y-6 max-w-3xl">
        {header}
        <ContractEditor
          tenants={tenants}
          owner={{ ownerName: contract.account.ownerName, businessName: contract.account.name }}
          initial={{
            id: contract.id,
            tenantId: contract.tenantId,
            title: contract.title,
            body: contract.body,
            startDate: iso(contract.startDate),
            endDate: iso(contract.endDate),
            monthlyRent: contract.monthlyRent != null ? String(contract.monthlyRent) : "",
            deposit: contract.deposit != null ? String(contract.deposit) : "",
          }}
        />
      </div>
    );
  }

  const steps = [
    { label: "You signed", at: contract.ownerSignedAt, by: contract.ownerSignedName },
    { label: "Sent to tenant", at: contract.sentAt },
    { label: "Tenant opened it", at: contract.viewedAt },
    { label: "Tenant signed", at: contract.tenantSignedAt, by: contract.tenantSignedName },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {header}

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <ol className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3 text-sm">
              {s.at ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-400" /> : <Circle className="h-4 w-4 mt-0.5 text-gray-600" />}
              <div>
                <p className={s.at ? "text-white" : "text-gray-500"}>{s.label}{s.by ? ` — ${s.by}` : ""}</p>
                {s.at && <p className="text-xs text-gray-500">{when(s.at)}</p>}
              </div>
            </li>
          ))}
          {contract.status === "void" && <li className="text-sm text-red-400">This contract was voided. The signing link no longer works.</li>}
        </ol>
        <div className="flex flex-col gap-2 md:w-56">
          <a href={`/api/contracts/${contract.id}/pdf`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Download className="h-4 w-4" /> Download PDF
          </a>
          <ContractActions
            id={contract.id}
            status={contract.status}
            signLink={signUrl(contract.signToken)}
            tenantHasEmail={!!contract.tenant.email}
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {contract.startDate && <p className="text-gray-400">Start: <span className="text-white">{formatDate(contract.startDate)}</span></p>}
          {contract.endDate && <p className="text-gray-400">End: <span className="text-white">{formatDate(contract.endDate)}</span></p>}
          {contract.monthlyRent != null && <p className="text-gray-400">Rent: <span className="text-white">{formatCurrency(contract.monthlyRent)}/mo</span></p>}
          {contract.deposit != null && <p className="text-gray-400">Deposit: <span className="text-white">{formatCurrency(contract.deposit)}</span></p>}
        </div>
        <pre className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-4 font-sans text-sm leading-relaxed text-gray-300">{contract.body}</pre>
        {contract.documentHash && (
          <p className="break-all text-[11px] text-gray-600">Document fingerprint (SHA-256): {contract.documentHash}</p>
        )}
      </div>
    </div>
  );
}
