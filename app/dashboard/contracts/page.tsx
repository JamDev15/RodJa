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
          <h1 className="text-2xl font-bold text-th-ink">Contracts</h1>
          <p className="text-th-muted text-sm mt-1">Send lease contracts your tenants sign online. Download the signed PDF anytime.</p>
        </div>
        <Link href="/dashboard/contracts/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-th-brand px-4 py-2 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover">
          <Plus className="h-4 w-4" /> New contract
        </Link>
      </div>

      {awaiting > 0 && (
        <div className="rounded-xl border border-th-due/30 bg-th-due-soft p-4 text-sm text-th-due">
          {awaiting} contract{awaiting === 1 ? " is" : "s are"} waiting for the tenant&apos;s signature.
        </div>
      )}

      {contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-th-line p-10 text-center">
          <FileSignature className="mx-auto h-8 w-8 text-th-faint" />
          <p className="mt-3 text-sm text-th-muted">No contracts yet.</p>
          <p className="text-xs text-th-faint mt-1">Start from a ready-made Philippine residential lease template.</p>
          <Link href="/dashboard/contracts/new" className="mt-4 inline-block text-sm text-th-accent hover:text-th-accent">Create your first contract →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-th-line rounded-xl border border-th-line overflow-hidden">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/contracts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-th-raised">
                <FileSignature className="h-5 w-5 shrink-0 text-th-faint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-th-ink">{c.title}</p>
                  <p className="truncate text-xs text-th-faint">
                    {c.tenant.name} · {c.tenant.unit.property.name} Unit {c.tenant.unit.unitNumber}
                    {c.endDate ? ` · ends ${formatDate(c.endDate)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ContractStatusBadge status={c.status} />
                  <span className="text-[11px] text-th-faint">{formatDate(c.tenantSignedAt ?? c.sentAt ?? c.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
