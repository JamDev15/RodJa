import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  isCurrency?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
  href?: string;
}

export function StatCard({ title, value, icon: Icon, trend, isCurrency, variant = "default", href }: StatCardProps) {
  const colorMap = {
    default: "text-th-accent bg-th-brand-soft",
    success: "text-th-paid bg-th-paid-soft",
    warning: "text-th-due bg-th-due-soft",
    danger: "text-th-danger bg-th-danger-soft",
  };

  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-th-muted">{title}</span>
        <div className={cn("rounded-lg p-2", colorMap[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-th-ink">
        {isCurrency ? formatCurrency(Number(value)) : value}
      </p>
      {trend && <p className="text-xs text-th-faint mt-1">{trend}</p>}
    </>
  );

  const className = "block rounded-xl border border-th-line bg-th-surface p-5 hover:bg-th-raised transition-colors";

  if (href) {
    return <Link href={href} className={className}>{content}</Link>;
  }
  return <div className={className}>{content}</div>;
}
