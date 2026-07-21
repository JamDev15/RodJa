import { cn, formatCurrency } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  isCurrency?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
}

export function StatCard({ title, value, icon: Icon, trend, isCurrency, variant = "default" }: StatCardProps) {
  const colorMap = {
    default: "text-blue-400 bg-blue-400/10",
    success: "text-green-400 bg-green-400/10",
    warning: "text-yellow-400 bg-yellow-400/10",
    danger: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{title}</span>
        <div className={cn("rounded-lg p-2", colorMap[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">
        {isCurrency ? formatCurrency(Number(value)) : value}
      </p>
      {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
    </div>
  );
}
