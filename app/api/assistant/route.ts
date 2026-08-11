import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseMessage, type TenantLite } from "@/lib/assistant/parse";
import { upsertMonthlyLedger } from "@/lib/ledger";
import { applyTenantUpdate, PhoneTakenError } from "@/lib/tenants";
import {
  assistantBillSchema,
  assistantNoticeSchema,
  assistantMaintenanceSchema,
  tenantUpdateSchema,
  formatZodError,
} from "@/lib/validations";
import { formatCurrency, getMonthLabel } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  const accountId = user?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Widget is landlord-only in the UI; enforce it here too so staff can't
  // reach it by calling the API directly.
  if (user.role !== "LANDLORD") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const payload = (body ?? {}) as Record<string, unknown>;

  if (payload.mode === "confirm") {
    return handleConfirm(accountId, payload.action as ClientAction);
  }

  const message = typeof payload.message === "string" ? payload.message : "";
  const tenantIdHint = typeof payload.tenantIdHint === "string" ? payload.tenantIdHint : undefined;

  const tenants: TenantLite[] = (
    await prisma.tenant.findMany({
      where: { unit: { property: { accountId } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((t) => ({ id: t.id, name: t.name }));

  const result = parseMessage(message, tenants, tenantIdHint);

  if (result.type === "action") {
    return NextResponse.json({ reply: result.reply, action: result.action });
  }
  if (result.type === "clarify") {
    return NextResponse.json({ reply: result.reply, clarify: { candidates: result.candidates } });
  }
  return NextResponse.json({ reply: result.reply });
}

interface ClientAction {
  kind: string;
  data: Record<string, unknown>;
}

async function handleConfirm(accountId: string, action: ClientAction) {
  if (!action || typeof action.kind !== "string") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  switch (action.kind) {
    case "add_bill":
      return confirmAddBill(accountId, action.data);
    case "update_tenant":
      return confirmUpdateTenant(accountId, action.data);
    case "add_notice":
      return confirmAddNotice(accountId, action.data);
    case "add_maintenance":
      return confirmAddMaintenance(accountId, action.data);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

async function findOwnedTenant(accountId: string, tenantId: string) {
  return prisma.tenant.findFirst({
    where: { id: tenantId, unit: { property: { accountId } } },
    include: { unit: true },
  });
}

async function confirmAddBill(accountId: string, data: unknown) {
  const parsed = assistantBillSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { tenantId, month, billType, amount, otherLabel } = parsed.data;

  const tenant = await findOwnedTenant(accountId, tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const existing = await prisma.monthlyLedger.findUnique({ where: { tenantId_month: { tenantId, month } } });

  const entry = await upsertMonthlyLedger(tenantId, month, {
    rentAmount: billType === "rent" ? amount : existing?.rentAmount ?? tenant.unit.rentAmount,
    rentPaidAmount: existing?.rentPaidAmount ?? null,
    rentPaid: existing?.rentPaid ?? false,
    electricAmount: billType === "electric" ? amount : existing?.electricAmount ?? null,
    electricPaidAmount: existing?.electricPaidAmount ?? null,
    electricPaid: existing?.electricPaid ?? false,
    waterAmount: billType === "water" ? amount : existing?.waterAmount ?? null,
    waterPaidAmount: existing?.waterPaidAmount ?? null,
    waterPaid: existing?.waterPaid ?? false,
    otherAmount: billType === "other" ? amount : existing?.otherAmount ?? null,
    otherPaidAmount: existing?.otherPaidAmount ?? null,
    otherLabel: billType === "other" ? otherLabel ?? existing?.otherLabel ?? "Other" : existing?.otherLabel ?? null,
    otherPaid: existing?.otherPaid ?? false,
    balance: existing?.balance ?? 0,
    balancePaid: existing?.balancePaid ?? false,
    notes: existing?.notes ?? null,
  });

  const label = billType === "other" ? otherLabel ?? "Other" : billType[0].toUpperCase() + billType.slice(1);
  return NextResponse.json({
    reply: `Saved — ${formatCurrency(amount)} ${label} bill for ${tenant.name}, ${getMonthLabel(month)}.`,
    result: entry,
  });
}

async function confirmUpdateTenant(accountId: string, data: Record<string, unknown>) {
  const tenantId = typeof data?.tenantId === "string" ? data.tenantId : "";
  const fields: Record<string, unknown> = { ...data };
  delete fields.tenantId;
  const parsed = tenantUpdateSchema.safeParse(fields);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const tenant = await findOwnedTenant(accountId, tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const updated = await applyTenantUpdate(tenantId, tenant.phone, parsed.data);
    return NextResponse.json({ reply: `Updated ${tenant.name}.`, result: updated });
  } catch (err) {
    if (err instanceof PhoneTakenError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

async function confirmAddNotice(accountId: string, data: unknown) {
  const parsed = assistantNoticeSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { tenantId, title, content, type } = parsed.data;

  let tenantName: string | null = null;
  if (tenantId) {
    const tenant = await findOwnedTenant(accountId, tenantId);
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    tenantName = tenant.name;
  }

  const notice = await prisma.notice.create({
    data: { accountId, tenantId: tenantId ?? null, title, content, type: type ?? "general" },
  });

  return NextResponse.json({
    reply: `Notice posted${tenantName ? ` to ${tenantName}` : " to all tenants"}.`,
    result: notice,
  });
}

async function confirmAddMaintenance(accountId: string, data: unknown) {
  const parsed = assistantMaintenanceSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { tenantId, title, description, priority } = parsed.data;

  const tenant = await findOwnedTenant(accountId, tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const request = await prisma.maintenanceRequest.create({
    data: { tenantId, title, description, priority: priority ?? "normal" },
  });

  return NextResponse.json({ reply: `Logged maintenance request for ${tenant.name}.`, result: request });
}
