import Link from "next/link";
import { BrandMark } from "./brand";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "Questions" },
      { href: "/signup", label: "Start a free trial" },
    ],
  },
  {
    title: "For tenants",
    links: [
      { href: "/tenant/login", label: "Tenant portal" },
      { href: "/listings", label: "Rentals available now" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Owner sign in" },
      { href: "/renew", label: "Reactivate an account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-th-line bg-th-surface px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7" />
            <span className="th-display text-[22px] text-th-ink">TenantHub</span>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-th-muted">
            Rent tracking, reminders, leases, and receipts for landlords in the Philippines.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h2 className="text-[13px] font-semibold text-th-ink">{c.title}</h2>
            <ul className="mt-3 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[14px] text-th-muted transition-colors hover:text-th-ink">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-6xl border-t border-th-line">
        <div className="flex flex-col justify-between gap-2 py-6 text-[12px] text-th-faint sm:flex-row">
          <p>© {new Date().getFullYear()} TenantHub. Made in the Philippines.</p>
          <p>₱499/month after a 3-day free trial. Prices in Philippine pesos.</p>
        </div>
      </div>
    </footer>
  );
}
