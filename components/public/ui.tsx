import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";

/** Themed building blocks for public forms (signup, login, renew, tenant login). */

export const thLabel = "block text-[14px] font-medium text-th-ink";
export const thHint = "text-[13px] text-th-faint";
export const thLink = "font-medium text-th-brand hover:text-th-brand-hover";
export const thPrimary =
  "inline-flex w-full items-center justify-center rounded-full bg-th-brand px-5 py-3 text-[15px] font-semibold text-th-on-brand transition-colors hover:bg-th-brand-hover disabled:cursor-not-allowed disabled:opacity-60";
export const thSecondary =
  "inline-flex w-full items-center justify-center rounded-full border border-th-line bg-th-surface px-5 py-3 text-[15px] font-semibold text-th-ink transition-colors hover:bg-th-raised";

export function Notice({ tone, children }: { tone: "error" | "info" | "success"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-th-danger/30 bg-th-danger/10 text-th-danger"
      : tone === "success"
      ? "border-th-paid/30 bg-th-paid-soft text-th-paid"
      : "border-th-brand/25 bg-th-brand-soft text-th-ink";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${cls}`}>{children}</div>;
}

/** Page frame for single-task public pages: slim header, centered column. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  width = "max-w-md",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <div className="th-public flex min-h-screen flex-col antialiased">
      <SiteHeader minimal />
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className={`w-full ${width}`}>
          <div className="mb-8 text-center">
            <h1 className="th-display text-[36px] leading-[1.05] text-th-ink sm:text-[44px]">{title}</h1>
            {subtitle && <div className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-th-muted">{subtitle}</div>}
          </div>
          <div className="rounded-[22px] border border-th-line bg-th-tint p-2 sm:p-3"><div className="th-shadow rounded-2xl border border-th-line bg-th-surface p-6 sm:p-8">{children}</div></div>
          {footer && <div className="mt-6 space-y-2 text-center text-[14px] text-th-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
