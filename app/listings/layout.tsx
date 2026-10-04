import Link from "next/link";
import { Home } from "lucide-react";
import { ThemeToggle } from "@/components/public/theme-toggle";

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-th-canvas text-th-ink flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-th-line bg-th-canvas/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-th-brand shrink-0">
              <Home className="h-4 w-4 text-th-on-brand" />
            </div>
            <span className="font-bold text-th-ink text-lg">TenantHub</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link href="/login" className="text-sm text-th-muted hover:text-th-ink transition-colors">Sign In</Link>
            <Link href="/signup" className="whitespace-nowrap rounded-lg bg-th-brand px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-th-on-brand hover:bg-th-brand-hover transition-colors">
              <span className="sm:hidden">Start Free</span>
              <span className="hidden sm:inline">Get Started Free</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-th-line py-8 text-center text-sm text-th-faint">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Home className="h-4 w-4 text-th-accent" />
          <span className="font-semibold text-th-ink">TenantHub</span>
        </div>
        © {new Date().getFullYear()} TenantHub. All rights reserved.
      </footer>
    </div>
  );
}
