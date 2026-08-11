import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ledgerCreateSchema, formatZodError } from "@/lib/validations";
import { upsertMonthlyLedger } from "@/lib/ledger";

const carryOverSchema = z.object({
  tenantId: z.string().min(1),
  currentMonth: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
});

export async function GET(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.monthlyLedger.findMany({
    where: { tenantId },
    orderBy: { month: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = ledgerCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const data = parsed.data;

  const tenant = await prisma.tenant.findFirst({ where: { id: data.tenantId, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tenantId, month } = data;
  const entry = await upsertMonthlyLedger(tenantId, month, {
    rentAmount: data.rentAmount,
    rentPaidAmount: body.rentPaidAmount != null && body.rentPaidAmount !== "" ? Number(body.rentPaidAmount) : null,
    electricAmount: data.electricAmount ?? null,
    electricPaidAmount: body.electricPaidAmount != null && body.electricPaidAmount !== "" ? Number(body.electricPaidAmount) : null,
    waterAmount: data.waterAmount ?? null,
    waterPaidAmount: body.waterPaidAmount != null && body.waterPaidAmount !== "" ? Number(body.waterPaidAmount) : null,
    otherAmount: data.otherAmount ?? null,
    otherPaidAmount: body.otherPaidAmount != null && body.otherPaidAmount !== "" ? Number(body.otherPaidAmount) : null,
    otherLabel: data.otherLabel || null,
    balance: body.balance != null ? Number(body.balance) || 0 : 0,
    balancePaid: body.balancePaid ?? false,
    rentPaid: body.rentPaid ?? false,
    electricPaid: body.electricPaid ?? false,
    waterPaid: body.waterPaid ?? false,
    otherPaid: body.otherPaid ?? false,
    notes: data.notes || null,
  });
  return NextResponse.json(entry);
}

// Compute unpaid carry-over from the previous month
export async function PUT(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = carryOverSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  const { tenantId, currentMonth } = parsed.data;
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [y, m] = currentMonth.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const prev = await prisma.monthlyLedger.findUnique({ where: { tenantId_month: { tenantId, month: prevMonth } } });
  if (!prev) return NextResponse.json({ unpaidTotal: 0, prevMonth, breakdown: [] });

  const breakdown: { label: string; amount: number }[] = [];

  // Per-bill balance = billed - paid (or full amount if not paid)
  const rentBal = prev.rentPaidAmount != null
    ? Math.max(0, prev.rentAmount - prev.rentPaidAmount)
    : prev.rentPaid ? 0 : prev.rentAmount;
  if (rentBal > 0) breakdown.push({ label: "Rent", amount: rentBal });

  const elecBal = prev.electricAmount != null
    ? (prev.electricPaidAmount != null ? Math.max(0, prev.electricAmount - prev.electricPaidAmount) : prev.electricPaid ? 0 : prev.electricAmount)
    : 0;
  if (elecBal > 0) breakdown.push({ label: "Electric", amount: elecBal });

  const waterBal = prev.waterAmount != null
    ? (prev.waterPaidAmount != null ? Math.max(0, prev.waterAmount - prev.waterPaidAmount) : prev.waterPaid ? 0 : prev.waterAmount)
    : 0;
  if (waterBal > 0) breakdown.push({ label: "Water", amount: waterBal });

  const otherBal = prev.otherAmount != null
    ? (prev.otherPaidAmount != null ? Math.max(0, prev.otherAmount - prev.otherPaidAmount) : prev.otherPaid ? 0 : prev.otherAmount)
    : 0;
  if (otherBal > 0) breakdown.push({ label: prev.otherLabel ?? "Other", amount: otherBal });

  // Carry the carry-over balance too if unpaid
  const carryBal = prev.balance > 0 && !prev.balancePaid ? prev.balance : 0;
  if (carryBal > 0) breakdown.push({ label: "Previous balance", amount: carryBal });

  const unpaidTotal = breakdown.reduce((s, b) => s + b.amount, 0);
  return NextResponse.json({ unpaidTotal, prevMonth, breakdown });
}
