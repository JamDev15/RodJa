"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Table2, BarChart3 } from "lucide-react";

export interface MonthlyBillTotals {
  month: string;
  label: string;
  rent: number;
  electric: number;
  water: number;
  other: number;
  total: number;
}

// Validated per the dataviz skill: 4-slot categorical set, dark-mode,
// adjacent-pair CVD/contrast checks all pass (see scripts/validate_palette.js).
const SERIES = [
  { key: "rent" as const, label: "Rent", color: "#3987e5" },
  { key: "electric" as const, label: "Electric (Kuryente)", color: "#d95926" },
  { key: "water" as const, label: "Water", color: "#199e70" },
  { key: "other" as const, label: "Other", color: "#c98500" },
];

// Round up to a "clean" axis max (nearest 1/2/5 x a power of ten).
function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function AnalyticsChart({ data }: { data: MonthlyBillTotals[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [tableView, setTableView] = useState(false);

  const rawMax = Math.max(...data.map((d) => d.total), 0);
  const axisMax = niceMax(rawMax || 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(axisMax * f));

  return (
    <div className="rounded-xl border border-th-line bg-th-surface p-5">
      <div className="flex items-center justify-between mb-6">
        {/* Legend — always present for >= 2 series */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-th-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
        <button
          onClick={() => setTableView((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-th-line bg-th-surface px-2.5 py-1.5 text-xs text-th-ink/80 hover:bg-th-raised transition-colors shrink-0"
        >
          {tableView ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {tableView ? "Chart view" : "Table view"}
        </button>
      </div>

      {tableView ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-line text-left text-th-muted">
                <th className="py-2 pr-4 font-medium">Month</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-2 pr-4 font-medium">{s.label}</th>
                ))}
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-line">
              {data.map((d) => (
                <tr key={d.month}>
                  <td className="py-2 pr-4 text-th-ink">{d.label}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-2 pr-4 text-th-ink/80">{formatCurrency(d[s.key])}</td>
                  ))}
                  <td className="py-2 text-th-ink font-medium">{formatCurrency(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Y-axis ticks */}
          <div className="flex flex-col justify-between text-right text-[10px] text-th-faint h-64 pb-6 shrink-0">
            {[...ticks].reverse().map((t) => (
              <span key={t}>{formatCurrency(t)}</span>
            ))}
          </div>

          <div className="relative flex-1">
            {/* Gridlines */}
            <div className="absolute inset-x-0 top-0 h-64 flex flex-col justify-between pb-6">
              {ticks.map((t) => (
                <div key={t} className="border-t border-th-line" />
              ))}
            </div>

            <div className="relative flex items-end justify-between gap-2 h-64 pb-6">
              {data.map((d, i) => {
                const nonZeroSeries = SERIES.filter((s) => d[s.key] > 0);
                const lastKey = nonZeroSeries[nonZeroSeries.length - 1]?.key;
                return (
                  <div
                    key={d.month}
                    className="relative flex-1 flex flex-col items-center justify-end h-full max-w-[64px]"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  >
                    {d.total > 0 && (
                      <p className="text-[10px] text-th-muted mb-1 whitespace-nowrap">{formatCurrency(d.total)}</p>
                    )}
                    <div className="w-full flex flex-col-reverse gap-[2px]" style={{ height: `${(d.total / axisMax) * 100}%` }}>
                      {SERIES.map((s) => {
                        const value = d[s.key];
                        if (value <= 0) return null;
                        const heightPct = (value / (d.total || 1)) * 100;
                        return (
                          <div
                            key={s.key}
                            className={s.key === lastKey ? "rounded-t-[4px]" : ""}
                            style={{ backgroundColor: s.color, height: `${heightPct}%`, opacity: hovered === null || hovered === i ? 1 : 0.4 }}
                          />
                        );
                      })}
                    </div>

                    {/* Hover tooltip */}
                    {hovered === i && (
                      <div className="absolute bottom-full mb-2 z-10 w-40 rounded-lg border border-th-line bg-th-surface p-3 shadow-xl text-left">
                        <p className="text-xs font-semibold text-th-ink mb-1.5">{d.label}</p>
                        <div className="space-y-1">
                          {SERIES.map((s) => (
                            <div key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="flex items-center gap-1 text-th-muted">
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                {s.label}
                              </span>
                              <span className="text-th-ink">{formatCurrency(d[s.key])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex items-center justify-between gap-2">
              {data.map((d) => (
                <span key={d.month} className="flex-1 max-w-[64px] text-center text-[10px] text-th-faint truncate">
                  {d.label.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
