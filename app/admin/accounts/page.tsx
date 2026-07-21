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
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">{accounts.length} total accounts</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Account</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Properties</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Joined</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link href={`/admin/accounts/${account.id}`} className="font-medium text-white hover:text-purple-400">
                    {account.name}
                  </Link>
                  <p className="text-xs text-gray-500">{account.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-400">{account.plan.name}</td>
                <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{account._count.properties}</td>
                <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{formatDate(account.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge variant={account.isActive ? "success" : "destructive"}>
                    {account.isActive ? "Active" : "Suspended"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <AccountActions accountId={account.id} isActive={account.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
