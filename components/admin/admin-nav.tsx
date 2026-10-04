"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Users, CreditCard, Globe, Settings, LogOut, ShieldCheck, Tag, Menu, X, ArrowLeft, UserPlus, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/public/theme-toggle";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/signups", label: "Signups", icon: UserPlus },
  { href: "/admin/workflows", label: "Workflows", icon: Workflow },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Tag },
  { href: "/admin/listings", label: "Listings", icon: Globe },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/admin/dashboard";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-th-line bg-th-surface px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            {!isHome && (
              <button
                onClick={() => router.back()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-th-muted hover:bg-th-raised hover:text-th-ink"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <p className="text-sm font-bold text-th-ink">TenantHub</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-th-muted hover:bg-th-raised hover:text-th-ink"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-th-line bg-th-surface transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-th-line">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-th-ink">TenantHub</p>
              <p className="text-xs text-th-violet">Super Admin</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-th-muted hover:bg-th-raised hover:text-th-ink lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-th-violet-soft text-th-violet font-medium" : "text-th-muted hover:bg-th-raised hover:text-th-ink"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 p-3 border-t border-th-line">
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-muted hover:bg-th-raised hover:text-th-danger transition-colors"
          >
            <LogOut className="h-4 w-4" />Sign Out
          </button>
          <ThemeToggle className="hidden lg:inline-flex" />
        </div>
      </aside>
    </>
  );
}
