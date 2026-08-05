"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Users, CreditCard, Globe, Settings, LogOut, ShieldCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Tag },
  { href: "/admin/listings", label: "Listings", icon: Globe },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-[#0d1117] fixed left-0 top-0 z-40">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">TenantHub</p>
          <p className="text-xs text-purple-400">Super Admin</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active ? "bg-purple-600/20 text-purple-400 font-medium" : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />Sign Out
        </button>
      </div>
    </aside>
  );
}
