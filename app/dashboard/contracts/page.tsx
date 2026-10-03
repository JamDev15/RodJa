import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { ContractStatusBadge } from "./status-badge";

export default async function ContractsPage() {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const contracts = await prisma.contract.findMany({
    where: { accountId },
    include: { tenant: { include: { unit: { include: { property: true } } } } },
    orderBy: { updatedAt: "desc" },
  });

  const awaiting = contracts.filter((c) => c.status === "sent").length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contracts</h1>
          <p className="text-gray-400 text-sm mt-1">Send lease contracts your tenants sign online. Download the signed PDF anytime.</p>
        </div>
        <Link href="/dashboard/contracts/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New contract
        </Link>
      </div>

      {awaiting > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
          {awaiting} contract{awaiting === 1 ? " is" : "s are"} waiting for the tenant&apos;s signature.
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
          <FileSignature className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-3 text-sm text-gray-400">No contracts yet.</p>
          <p className="text-xs text-gray-500 mt-1">Start from a ready-made Philippine residential lease template.</p>
          <Link href="/dashboard/contracts/new" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">Create your first contract →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10 overflow-hidden">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/contracts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5">
                <FileSignature className="h-5 w-5 shrink-0 text-gray-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{c.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {c.tenant.name} · {c.tenant.unit.property.name} Unit {c.tenant.unit.unitNumber}
                    {c.endDate ? ` · ends ${formatDate(c.endDate)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ContractStatusBadge status={c.status} />
                  <span className="text-[11px] text-gray-500">{formatDate(c.tenantSignedAt ?? c.sentAt ?? c.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
