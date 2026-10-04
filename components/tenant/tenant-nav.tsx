"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, CreditCard, Wrench, Bell, LogOut, ArrowLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/public/theme-toggle";

const navItems = [
  { href: "/tenant/dashboard", label: "Home", icon: Home },
  { href: "/tenant/pay", label: "Pay", icon: CreditCard },
  { href: "/tenant/documents", label: "Documents", icon: FileText },
  { href: "/tenant/maintenance", label: "Repairs", icon: Wrench },
  { href: "/tenant/notices", label: "Notices", icon: Bell },
];

export function TenantNav({ tenantName }: { tenantName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/tenant/dashboard";

  return (
    <>
      {/* Top header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-th-line bg-th-surface">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            {!isHome && (
              <button
                onClick={() => router.back()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-th-muted hover:bg-th-raised hover:text-th-ink"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="h-7 w-7 rounded-full bg-th-brand flex items-center justify-center text-xs font-bold text-th-on-brand">
            {tenantName?.[0] ?? "T"}
          </div>
          <span className="text-sm font-medium text-th-ink truncate max-w-[120px]">{tenantName}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/tenant/login" })}
            className="flex items-center gap-1.5 text-xs text-th-faint hover:text-th-ink transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-th-line bg-th-surface z-50">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors",
                  active ? "text-th-brand font-medium" : "text-th-faint hover:text-th-ink"
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
