"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, CreditCard, Wrench, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/tenant/dashboard", label: "Home", icon: Home },
  { href: "/tenant/pay", label: "Pay", icon: CreditCard },
  { href: "/tenant/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/tenant/notices", label: "Notices", icon: Bell },
];

export function TenantNav({ tenantName }: { tenantName?: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Top header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d1117]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {tenantName?.[0] ?? "T"}
          </div>
          <span className="text-sm font-medium text-white truncate max-w-[120px]">{tenantName}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/tenant/login" })}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0d1117] z-50">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                  active ? "text-blue-400" : "text-gray-500 hover:text-gray-300"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
