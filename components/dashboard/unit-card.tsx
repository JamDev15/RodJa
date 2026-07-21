"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { UnitStatusBadge } from "@/components/dashboard/payment-badge";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface UnitCardProps {
  unit: {
    id: string;
    unitNumber: string;
    floor: string | null;
    rentAmount: number;
    depositAmount: number | null;
    status: string;
    propertyId: string;
  };
  tenantName?: string;
}

export function UnitCard({ unit, tenantName }: UnitCardProps) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    setDuplicating(true);
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFrom: unit.id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Unit duplicated!", description: "Edit the copy to set a new unit number.", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Failed to duplicate unit", variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete Unit ${unit.unitNumber}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Unit deleted", variant: "success" });
      router.refresh();
    } catch (err: any) {
      toast({ title: err.message || "Failed to delete unit", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="group relative rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] hover:border-white/20 transition-all">
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/dashboard/units/${unit.id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
          title="Edit unit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 hover:bg-blue-500/30 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
          title="Duplicate unit"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {!tenantName && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 hover:bg-red-500/30 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
            title="Delete unit"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Card content — clicking navigates to detail */}
      <Link href={`/dashboard/units/${unit.id}`} className="block">
        <div className="flex items-center justify-between mb-2 pr-20">
          <span className="font-semibold text-white">Unit {unit.unitNumber}</span>
          <UnitStatusBadge status={unit.status} />
        </div>
        <p className="text-sm font-medium text-blue-400">{formatCurrency(unit.rentAmount)}/mo</p>
        {tenantName ? (
          <p className="text-xs text-gray-400 mt-1">Tenant: {tenantName}</p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">No tenant</p>
        )}
        {unit.floor && <p className="text-xs text-gray-600 mt-0.5">{unit.floor}</p>}
      </Link>
    </div>
  );
}
