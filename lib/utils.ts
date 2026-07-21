import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function getPaymentStatusColor(status: string): string {
  const map: Record<string, string> = {
    approved: "text-green-400 bg-green-400/10",
    submitted: "text-blue-400 bg-blue-400/10",
    pending: "text-yellow-400 bg-yellow-400/10",
    late: "text-red-400 bg-red-400/10",
    waived: "text-gray-400 bg-gray-400/10",
  };
  return map[status] ?? "text-gray-400 bg-gray-400/10";
}

export function getUnitStatusColor(status: string): string {
  const map: Record<string, string> = {
    occupied: "text-green-400 bg-green-400/10",
    vacant: "text-blue-400 bg-blue-400/10",
    maintenance: "text-yellow-400 bg-yellow-400/10",
  };
  return map[status] ?? "text-gray-400 bg-gray-400/10";
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(date);
}
