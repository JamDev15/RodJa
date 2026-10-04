import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLink } from "./brand";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "Questions" },
  { href: "/listings", label: "Rentals" },
];

export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-th-line/60 bg-th-page/85 px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4">
        <BrandLink />
        {!minimal && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 text-[13px] font-medium text-th-muted transition-colors hover:text-th-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link href="/login" className="hidden rounded-full px-3 py-2 text-[13px] font-medium text-th-ink hover:bg-th-raised sm:inline-flex">
            Sign in
          </Link>
          <Link href="/signup" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-th-brand px-4 py-2 text-[13px] font-semibold text-th-on-brand transition-colors hover:bg-th-brand-hover">
            <span className="sm:hidden">Try free</span>
            <span className="hidden sm:inline">Start free trial</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
