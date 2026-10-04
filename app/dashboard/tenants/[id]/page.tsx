import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Calendar, Home, Pencil, Clock, FileSignature, Download } from "lucide-react";
import { PaymentBadge } from "@/components/dashboard/payment-badge";
import { Badge } from "@/components/ui/badge";
import { ProofPreview } from "@/components/ui/proof-preview";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AddPaymentButton } from "./add-payment-button";
import { TenantLedger } from "@/components/dashboard/tenant-ledger";
import { MessageHistoryList } from "@/components/dashboard/message-history";
import { ContractStatusBadge } from "@/app/dashboard/contracts/status-badge";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;

  const tenant = await prisma.tenant.findFirst({
    where: { id, unit: { property: { accountId } } },
    include: {
      unit: { include: { property: true } },
      payments: { orderBy: { dueDate: "desc" } },
      maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      contracts: { where: { status: { not: "void" } }, orderBy: { updatedAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" }, take: 12 },
      messageLogs: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!tenant) notFound();

  const totalPaid = tenant.payments.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);
  const pendingAmount = tenant.payments.filter((p) => ["pending", "submitted"].includes(p.status)).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/tenants" className="rounded-lg p-1.5 hover:bg-th-raised text-th-muted hover:text-th-ink transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-th-ink">{tenant.name}</h1>
          <p className="text-th-muted text-sm">{tenant.unit.property.name} – Unit {tenant.unit.unitNumber}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={tenant.isActive ? "success" : "secondary"}>{tenant.isActive ? "Active" : "Past"}</Badge>
          <Link
            href={`/dashboard/contracts/new?tenantId=${id}`}
            className="flex items-center gap-1.5 rounded-lg border border-th-line bg-th-surface px-3 py-1.5 text-sm text-th-muted hover:text-th-ink hover:bg-th-raised transition-colors"
          >
            <FileSignature className="h-3.5 w-3.5" />
            Contract
          </Link>
          <Link
            href={`/dashboard/tenants/${id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-th-line bg-th-surface px-3 py-1.5 text-sm text-th-muted hover:text-th-ink hover:bg-th-raised transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-th-line bg-th-surface p-5 space-y-3">
          <h3 className="font-semibold text-th-ink">Contact Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-th-muted"><Phone className="h-4 w-4" />{tenant.phone}</div>
            {tenant.email && <div className="flex items-center gap-2 text-th-muted"><Mail className="h-4 w-4" />{tenant.email}</div>}
            <div className="flex items-center gap-2 text-th-muted"><Calendar className="h-4 w-4" />Moved in {formatDate(tenant.moveInDate)}</div>
            <div className="flex items-center gap-2 text-th-muted"><Home className="h-4 w-4" />Unit {tenant.unit.unitNumber} · {formatCurrency(tenant.unit.rentAmount)}/mo</div>
            <div className="flex items-center gap-2 text-th-muted"><Clock className="h-4 w-4" />Rent due on day {tenant.dueDay} of each month</div>
          </div>
          <div className="pt-2 text-xs text-th-faint">
            Portal PIN is hidden for security.{" "}
            <Link href={`/dashboard/tenants/${id}/edit`} className="text-th-accent hover:text-th-accent">
              Reset it
            </Link>{" "}
            if the tenant forgot theirs.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-th-line bg-th-paid-soft p-4 text-center">
            <p className="text-xl font-bold text-th-paid">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-th-faint mt-1">Total Paid</p>
          </div>
          <div className="rounded-xl border border-th-line bg-th-due-soft p-4 text-center">
            <p className="text-xl font-bold text-th-due">{formatCurrency(pendingAmount)}</p>
            <p className="text-xs text-th-faint mt-1">Pending</p>
          </div>
          {tenant.depositAmount && (
            <div className="rounded-xl border border-th-line bg-th-surface p-4 text-center col-span-2">
              <p className="text-xl font-bold text-th-ink">{formatCurrency(tenant.depositAmount)}</p>
              <p className="text-xs text-th-faint mt-1">Deposit</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Bill Tracker */}
      <div className="rounded-xl border border-th-line bg-th-surface p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-th-ink">Monthly Bill Tracker</h2>
          <p className="text-xs text-th-faint mt-0.5">Rent · Electric · Water · Other — per month since {formatDate(tenant.moveInDate)}</p>
        </div>
        <TenantLedger
          tenantId={tenant.id}
          moveInDate={tenant.moveInDate}
          defaultRent={tenant.unit.rentAmount}
        />
      </div>

      {/* Contracts + invoices/receipts */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-th-line bg-th-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-th-ink">Contracts</h2>
            <Link href={`/dashboard/contracts/new?tenantId=${id}`} className="text-xs text-th-accent hover:text-th-accent">+ New</Link>
          </div>
          {tenant.contracts.length === 0 ? (
            <p className="text-sm text-th-faint">No contract yet. Send one to sign online.</p>
          ) : (
            <ul className="space-y-2">
              {tenant.contracts.map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/contracts/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-th-raised">
                    <span className="truncate text-sm text-th-ink">{c.title}</span>
                    <ContractStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-th-line bg-th-surface p-5">
          <h2 className="mb-1 font-semibold text-th-ink">Invoices &amp; receipts</h2>
          <p className="mb-3 text-xs text-th-faint">Send from the bill tracker above. Receipts go out automatically when you mark bills paid.</p>
          {tenant.invoices.length === 0 ? (
            <p className="text-sm text-th-faint">None sent yet.</p>
          ) : (
            <ul className="space-y-1">
              {tenant.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-th-raised">
                  <div className="min-w-0">
                    <p className="text-sm text-th-ink">
                      <span className={inv.type === "invoice" ? "text-th-accent" : "text-th-paid"}>{inv.number}</span>
                      <span className="text-th-muted"> · {formatCurrency(inv.total)}</span>
                    </p>
                    <p className="text-xs text-th-faint">{formatDate(inv.createdAt)}{inv.sentAt ? " · emailed" : ""}</p>
                  </div>
                  <a href={`/api/invoices/${inv.id}/pdf`} className="rounded-md p-1.5 text-th-muted hover:bg-th-raised hover:text-th-ink" title="Download PDF">
                    <Download className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Payments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-th-ink">Payment History</h2>
          <AddPaymentButton tenantId={tenant.id} rentAmount={tenant.unit.rentAmount} />
        </div>
        <div className="rounded-xl border border-th-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-th-line bg-th-surface">
                <th className="text-left px-4 py-3 text-th-muted font-medium">Month</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Due Date</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Method</th>
                <th className="text-left px-4 py-3 text-th-muted font-medium hidden md:table-cell">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-line">
              {tenant.payments.length === 0 && (
                <tr><td colSpan={6} className="text-center text-th-faint py-8">No payment records</td></tr>
              )}
              {tenant.payments.map((p) => (
                <tr key={p.id} className="hover:bg-th-raised">
                  <td className="px-4 py-3 text-th-ink font-medium">{p.month}</td>
                  <td className="px-4 py-3 text-th-ink">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-th-muted">{formatDate(p.dueDate)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-th-muted hidden md:table-cell capitalize">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ProofPreview url={p.proofUrl} label={`${tenant.name} — ${p.month}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-th-ink">Messages sent</h2>
          <Link href={`/dashboard/messages?q=${encodeURIComponent(tenant.name)}`} className="text-sm text-th-accent hover:text-th-accent">View all →</Link>
        </div>
        <MessageHistoryList
          messages={tenant.messageLogs}
          showTenantLink={false}
          emptyText="Nothing sent to or about this tenant yet."
        />
      </div>

      {/* Maintenance Requests */}
      {tenant.maintenanceRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-th-ink mb-3">Maintenance Requests</h2>
          <div className="space-y-2">
            {tenant.maintenanceRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-th-line bg-th-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-th-ink">{req.title}</p>
                  <p className="text-xs text-th-faint">{formatDate(req.createdAt)}</p>
                </div>
                <Badge variant={req.status === "resolved" ? "success" : req.status === "in_progress" ? "default" : "warning"}>
                  {req.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
