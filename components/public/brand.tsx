import Link from "next/link";

/** House-and-door mark drawn for TenantHub (replaces the generic icon on public pages). */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-th-brand" />
      <path d="M8.5 15.2 16 9l7.5 6.2V23a1 1 0 0 1-1 1H9.5a1 1 0 0 1-1-1z" className="fill-th-on-brand" />
      <rect x="14" y="17.5" width="4" height="6.5" rx="1" className="fill-th-brand" />
    </svg>
  );
}

export function BrandLink() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="TenantHub home">
      <BrandMark />
      <span className="th-display text-[22px] leading-none text-th-ink">TenantHub</span>
    </Link>
  );
}
