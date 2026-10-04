import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AccountActions } from "./account-actions";

export default async function AdminAccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      _count: { select: { properties: true, users: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-th-ink">Accounts</h1>
          <p className="text-th-muted text-sm mt-1">{accounts.length} total accounts</p>
        </div>
      </div>

      <div className="rounded-xl border border-th-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-th-line bg-th-surface">
              <th className="text-left px-4 py-3 text-th-muted font-medium">Account</th>
              <th className="text-left px-4 py-3 text-th-muted font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Properties</th>
              <th className="text-left px-4 py-3 text-th-muted font-medium hidden lg:table-cell">Joined</th>
              <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
              <th className="text-left px-4 py-3 text-th-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-th-line">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-th-raised">
                <td className="px-4 py-3">
                  <Link href={`/admin/accounts/${account.id}`} className="font-medium text-th-ink hover:text-th-violet">
                    {account.name}
                  </Link>
                  <p className="text-xs text-th-faint">{account.email}</p>
                </td>
                <td className="px-4 py-3 text-th-muted">{account.plan.name}</td>
                <td className="px-4 py-3 text-th-muted hidden md:table-cell">{account._count.properties}</td>
                <td className="px-4 py-3 text-th-muted hidden lg:table-cell">{formatDate(account.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={account.isActive ? "success" : "destructive"}>
                      {account.isActive ? "Active" : "Suspended"}
                    </Badge>
                    {account.lifetimeAccess && <Badge variant="default">Lifetime</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AccountActions accountId={account.id} accountName={account.name} isActive={account.isActive} lifetimeAccess={account.lifetimeAccess} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
