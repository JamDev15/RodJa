"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Building2, Users, CreditCard, Bell,
  Settings, LogOut, ChevronRight, Globe, Receipt, Home
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Properties", icon: Building2 },
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
  { href: "/dashboard/listings", label: "Listings", icon: Globe },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  accountName?: string;
}

export function Sidebar({ accountName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-[#0d1117] fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Home className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">RodjaRent</p>
          {accountName && <p className="text-xs text-gray-500 truncate max-w-[120px]">{accountName}</p>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors group",
                active
                  ? "bg-blue-600/20 text-blue-400 font-medium"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {active && <ChevronRight className="ml-auto h-3 w-3" />}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
