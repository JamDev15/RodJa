import { CheckCircle2, XCircle, Clock, Upload, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Payment {
  month: string;
  amount: number;
  status: string;
  paidDate: Date | null;
  method: string | null;
}

interface MonthlyTrackerProps {
  moveInDate: Date;
  rentAmount: number;
  payments: Payment[];
}

function getMonthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function MonthCell({ month, payment, rentAmount }: { month: string; payment?: Payment; rentAmount: number }) {
  const [year, m] = month.split("-");
  const label = new Date(Number(year), Number(m) - 1).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });

  const status = payment?.status ?? "unpaid";

  const config: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string; text: string }> = {
    approved: {
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      icon: <CheckCircle2 className="h-4 w-4 text-green-400" />,
      label: "Paid",
      text: "text-green-400",
    },
    submitted: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      icon: <Upload className="h-4 w-4 text-blue-400" />,
      label: "Submitted",
      text: "text-blue-400",
    },
    pending: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      icon: <Clock className="h-4 w-4 text-yellow-400" />,
      label: "Pending",
      text: "text-yellow-400",
    },
    unpaid: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      icon: <XCircle className="h-4 w-4 text-red-400" />,
      label: "Unpaid",
      text: "text-red-400",
    },
  };

  const c = config[status] ?? config.unpaid;

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{label}</span>
        {c.icon}
      </div>
      <span className="text-xs text-gray-400">{formatCurrency(payment?.amount ?? rentAmount)}</span>
      <span className={`text-[10px] font-medium ${c.text}`}>{c.label}</span>
      {payment?.paidDate && (
        <span className="text-[10px] text-gray-600">
          {new Date(payment.paidDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

export function MonthlyTracker({ moveInDate, rentAmount, payments }: MonthlyTrackerProps) {
  const now = new Date();
  const months = getMonthsBetween(moveInDate, now);
  const paymentMap = new Map(payments.map((p) => [p.month, p]));

  const paidCount = payments.filter((p) => p.status === "approved").length;
  const totalMonths = months.length;
  const paidPct = totalMonths > 0 ? Math.round((paidCount / totalMonths) * 100) : 0;

  const unpaidCount = months.filter((m) => {
    const p = paymentMap.get(m);
    return !p || p.status === "unpaid";
  }).length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="text-gray-400">{paidCount} paid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="text-gray-400">{unpaidCount} unpaid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="text-gray-400">{payments.filter(p => p.status === "pending" || p.status === "submitted").length} pending</span>
        </div>
        <span className="ml-auto text-xs text-gray-500">{paidPct}% paid</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${paidPct}%` }}
        />
      </div>

      {/* Monthly grid — newest first */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {[...months].reverse().map((month) => (
          <MonthCell
            key={month}
            month={month}
            payment={paymentMap.get(month)}
            rentAmount={rentAmount}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 pt-1">
        {[
          { color: "bg-green-400", label: "Approved" },
          { color: "bg-blue-400", label: "Proof uploaded" },
          { color: "bg-yellow-400", label: "Pending" },
          { color: "bg-red-400", label: "No payment" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${l.color}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
