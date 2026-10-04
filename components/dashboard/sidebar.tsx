"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Building2, Users, CreditCard, Bell,
  Settings, LogOut, ChevronRight, Globe, Receipt, Home, HelpCircle, Menu, X, ArrowLeft,
  History, Zap, FileSignature, Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/public/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Properties", icon: Building2 },
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/contracts", label: "Contracts", icon: FileSignature },
  { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
  { href: "/dashboard/automations", label: "Automations", icon: Zap },
  { href: "/dashboard/workflows", label: "Workflows", icon: Workflow },
  { href: "/dashboard/messages", label: "Message History", icon: History },
  { href: "/dashboard/listings", label: "Listings", icon: Globe },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/help", label: "Help", icon: HelpCircle },
];

interface SidebarProps {
  accountName?: string;
}

export function Sidebar({ accountName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/dashboard";

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-th-brand">
            <Home className="h-4 w-4 text-th-on-brand" />
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

      {/* Backdrop (mobile only, while drawer is open) */}
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
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-th-line">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-th-brand">
              <Home className="h-4 w-4 text-th-on-brand" />
            </div>
            <div>
              <p className="text-sm font-bold text-th-ink">TenantHub</p>
              {accountName && <p className="text-xs text-th-faint truncate max-w-[120px]">{accountName}</p>}
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors group",
                  active
                    ? "bg-th-brand-soft text-th-brand font-medium"
                    : "text-th-muted hover:bg-th-raised hover:text-th-ink"
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
        <div className="flex items-center gap-1 p-3 border-t border-th-line">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-th-muted hover:bg-th-raised hover:text-th-danger transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          <ThemeToggle className="hidden lg:inline-flex" />
        </div>
      </aside>
    </>
  );
}
