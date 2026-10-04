import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, User } from "lucide-react";
import { PaymentBadge, UnitStatusBadge } from "@/components/dashboard/payment-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const unit = await prisma.unit.findFirst({
    where: { id, property: { accountId } },
    include: {
      property: true,
      tenants: {
        include: {
          payments: { orderBy: { dueDate: "desc" }, take: 6 },
        },
        orderBy: { moveInDate: "desc" },
      },
    },
  });

  if (!unit) notFound();
  const activeTenant = unit.tenants.find((t) => t.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/properties/${unit.propertyId}`} className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-th-ink">Unit {unit.unitNumber}</h1>
          <p className="text-th-muted text-sm">{unit.property.name}</p>
        </div>
        <UnitStatusBadge status={unit.status} />
      </div>

      {/* Unit Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-th-line bg-th-surface p-4">
          <p className="text-xs text-th-faint mb-1">Monthly Rent</p>
          <p className="text-xl font-bold text-th-ink">{formatCurrency(unit.rentAmount)}</p>
        </div>
        {unit.depositAmount && (
          <div className="rounded-xl border border-th-line bg-th-surface p-4">
            <p className="text-xs text-th-faint mb-1">Deposit</p>
            <p className="text-xl font-bold text-th-ink">{formatCurrency(unit.depositAmount)}</p>
          </div>
        )}
        {unit.floor && (
          <div className="rounded-xl border border-th-line bg-th-surface p-4">
            <p className="text-xs text-th-faint mb-1">Floor</p>
            <p className="text-xl font-bold text-th-ink">{unit.floor}</p>
          </div>
        )}
      </div>

      {/* Current Tenant */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-th-ink">Current Tenant</h2>
          {!activeTenant && (
            <Link
              href={`/dashboard/tenants/new?unitId=${id}`}
              className="flex items-center gap-1.5 rounded-lg bg-th-brand px-3 py-1.5 text-sm text-th-on-brand hover:bg-th-brand-hover transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Tenant
            </Link>
          )}
        </div>

        {!activeTenant ? (
          <div className="rounded-xl border border-dashed border-th-line py-10 text-center">
            <User className="h-10 w-10 text-th-faint mx-auto mb-3" />
            <p className="text-th-muted">No active tenant</p>
          </div>
        ) : (
          <div className="rounded-xl border border-th-line bg-th-surface p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-th-brand-soft text-th-accent font-bold text-lg">
                {activeTenant.name[0]}
              </div>
              <div>
                <Link href={`/dashboard/tenants/${activeTenant.id}`} className="text-th-ink font-semibold hover:text-th-accent transition-colors">
                  {activeTenant.name}
                </Link>
                <p className="text-sm text-th-muted">{activeTenant.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-th-faint text-xs">Move-in Date</p>
                <p className="text-th-ink">{formatDate(activeTenant.moveInDate)}</p>
              </div>
              {activeTenant.depositAmount && (
                <div>
                  <p className="text-th-faint text-xs">Deposit</p>
                  <p className="text-th-ink">{formatCurrency(activeTenant.depositAmount)}</p>
                </div>
              )}
            </div>

            {/* Recent Payments */}
            {activeTenant.payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-th-line">
                <p className="text-xs text-th-faint mb-2">Recent Payments</p>
                <div className="space-y-2">
                  {activeTenant.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-th-muted">{p.month}</span>
                      <span className="text-th-ink">{formatCurrency(p.amount)}</span>
                      <PaymentBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
