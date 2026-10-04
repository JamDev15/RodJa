import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContractEditor } from "../contract-editor";
import { loadTenantOptions } from "../tenant-options";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ tenantId?: string }> }) {
  const { tenantId } = await searchParams;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId as string;

  const [account, tenants] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { ownerName: true, name: true } }),
    loadTenantOptions(accountId),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/contracts" className="rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New contract</h1>
          <p className="text-gray-400 text-sm">Pick a tenant and we&apos;ll fill in a lease template you can edit.</p>
        </div>
      </div>
      {tenants.length === 0 ? (
        <p className="text-sm text-gray-400">Add a tenant first, then come back to create their contract.</p>
      ) : (
        <ContractEditor
          key={tenantId ?? "new"}
          tenants={tenants}
          owner={{ ownerName: account?.ownerName ?? "", businessName: account?.name ?? "" }}
          initial={{ tenantId: "", title: "", body: "", startDate: "", endDate: "", monthlyRent: "", deposit: "" }}
          preselectTenantId={tenants.some((t) => t.id === tenantId) ? tenantId : undefined}
        />
      )}
    </div>
  );
}
