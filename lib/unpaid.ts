import { dueDateForMonth, daysBetween } from "@/lib/due-dates";
import type { Payment, Tenant, Unit, Property } from "@prisma/client";

export interface UnpaidRow {
  tenantId: string;
  tenantName: string;
  unitLabel: string;
  amount: number;
  dueDate: Date;
  status: string;
  daysOverdue: number;
}

type TenantWithUnit = Tenant & { unit: Unit & { property: Property } };

// Tenants with no Payment row yet this month (not billed/submitted at all)
// would otherwise be invisible to any pending/overdue view — a due date has
// still passed or is approaching for them even without a record, so it's
// resolved against the same day-5 default the reminder engine uses. Shared
// between the dashboard overview and the dedicated pending/overdue pages so
// both agree on exactly who counts.
export function computeUnpaidRows(
  tenants: TenantWithUnit[],
  currentMonthPayments: Payment[],
  currentMonth: string,
  now: Date
): UnpaidRow[] {
  return tenants
    .map((tenant) => {
      const payment = currentMonthPayments.find((p) => p.tenantId === tenant.id);
      if (payment && ["approved", "waived"].includes(payment.status)) return null;
      const dueDate = payment?.dueDate ?? dueDateForMonth(currentMonth, tenant.dueDay);
      const diff = daysBetween(now, dueDate);
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        unitLabel: `${tenant.unit.property.name} – ${tenant.unit.unitNumber}`,
        amount: payment?.amount ?? tenant.unit.rentAmount,
        dueDate,
        status: payment?.status ?? (diff > 0 ? "late" : "pending"),
        daysOverdue: diff,
      } satisfies UnpaidRow;
    })
    .filter((r): r is UnpaidRow => r !== null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
