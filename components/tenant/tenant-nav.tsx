"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, CreditCard, Wrench, Bell, LogOut, ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/public/theme-toggle";

const navItems = [
  { href: "/tenant/dashboard", label: "Home", icon: Home },
  { href: "/tenant/pay", label: "Pay", icon: CreditCard },
  { href: "/tenant/documents", label: "Documents", icon: FileText },
  { href: "/tenant/maintenance", label: "Repairs", icon: Wrench },
  { href: "/tenant/notices", label: "Notices", icon: Bell },
];

export function TenantNav({ tenantName, billingEnabled = false, unreadMessages = 0 }: { tenantName?: string; billingEnabled?: boolean; unreadMessages?: number }) {
  const pathname = usePathname();
  // Everyone gets Messages; properties with statement billing get Bills instead of Pay.
  const items = [
    ...navItems.slice(0, 2).map((i) => (i.href === "/tenant/pay" && billingEnabled ? { ...i, href: "/tenant/billing", label: "Bills" } : i)),
    { href: "/tenant/messages", label: "Messages", icon: MessageSquare },
    ...navItems.slice(2).map((i) => (i.href === "/tenant/documents" ? { ...i, label: "Docs" } : i)),
  ];
  const router = useRouter();
  const isHome = pathname === "/tenant/dashboard";

  return (
    <>
      {/* Top header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-th-line bg-th-surface">
        <div className="flex min-w-0 items-center gap-2">
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
          <div className="h-7 w-7 shrink-0 rounded-full bg-th-brand flex items-center justify-center text-xs font-bold text-th-on-brand">
            {tenantName?.[0] ?? "T"}
          </div>
          <span className="min-w-0 truncate text-sm font-medium text-th-ink">{tenantName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/tenant/login" })}
            className="flex min-h-9 items-center gap-1.5 px-1 text-xs text-th-faint hover:text-th-ink transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-th-line bg-th-surface pb-safe">
        <div className="max-w-lg mx-auto flex">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || ((href === "/tenant/billing" || href === "/tenant/messages") && pathname.startsWith(href));
            const badge = href === "/tenant/messages" && unreadMessages > 0 ? unreadMessages : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 transition-colors",
                  items.length > 5 ? "text-[10px] min-[380px]:text-[11px]" : "text-[11px] min-[360px]:text-xs",
                  active ? "text-th-brand font-medium" : "text-th-faint hover:text-th-ink"
                )}
              >
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute left-1/2 top-1.5 ml-1.5 min-w-4 rounded-full bg-th-danger px-1 text-center text-[10px] font-semibold leading-4 text-white" aria-label={`${badge} unread`}>
                    {badge}
                  </span>
                )}
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
