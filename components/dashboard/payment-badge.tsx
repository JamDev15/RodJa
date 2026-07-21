import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  approved: { label: "Approved", variant: "success" },
  submitted: { label: "Submitted", variant: "default" },
  pending: { label: "Pending", variant: "warning" },
  late: { label: "Late", variant: "destructive" },
  waived: { label: "Waived", variant: "secondary" },
};

export function PaymentBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const unitStatusConfig: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  occupied: { label: "Occupied", variant: "success" },
  vacant: { label: "Vacant", variant: "default" },
  maintenance: { label: "Maintenance", variant: "warning" },
};

export function UnitStatusBadge({ status }: { status: string }) {
  const cfg = unitStatusConfig[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
