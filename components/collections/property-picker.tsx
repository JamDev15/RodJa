"use client";

import { usePathname, useRouter } from "next/navigation";

export function PropertyPicker({ properties, value }: { properties: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (properties.length < 2) return null;
  return (
    <select
      aria-label="Property"
      value={value}
      onChange={(e) => router.push(`${pathname}?propertyId=${e.target.value}`)}
      className="rounded-lg border border-th-line bg-th-surface px-3 py-2 text-base sm:text-sm text-th-ink focus:border-th-accent focus:outline-none"
    >
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
