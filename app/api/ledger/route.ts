import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ledgerCreateSchema, formatZodError } from "@/lib/validations";

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
  const rentAmount = data.rentAmount;
  const rentPaidAmt = body.rentPaidAmount != null && body.rentPaidAmount !== "" ? Number(body.rentPaidAmount) : null;
  const electricAmt = data.electricAmount ?? null;
  const electricPaidAmt = body.electricPaidAmount != null && body.electricPaidAmount !== "" ? Number(body.electricPaidAmount) : null;
  const waterAmt = data.waterAmount ?? null;
  const waterPaidAmt = body.waterPaidAmount != null && body.waterPaidAmount !== "" ? Number(body.waterPaidAmount) : null;
  const otherAmt = data.otherAmount ?? null;
  const otherPaidAmt = body.otherPaidAmount != null && body.otherPaidAmount !== "" ? Number(body.otherPaidAmount) : null;
  const balance = body.balance != null ? Number(body.balance) || 0 : 0;
  const balancePaid = body.balancePaid ?? false;

  // Derive paid booleans from paid amounts
  const rentPaid      = rentPaidAmt != null ? rentPaidAmt >= rentAmount : (body.rentPaid ?? false);
  const electricPaid  = electricAmt != null && electricPaidAmt != null ? electricPaidAmt >= electricAmt : (body.electricPaid ?? false);
  const waterPaid     = waterAmt != null && waterPaidAmt != null ? waterPaidAmt >= waterAmt : (body.waterPaid ?? false);
  const otherPaid     = otherAmt != null && otherPaidAmt != null ? otherPaidAmt >= otherAmt : (body.otherPaid ?? false);

  const shared = {
    rentAmount, rentPaidAmount: rentPaidAmt, rentPaid,
    electricAmount: electricAmt, electricPaidAmount: electricPaidAmt, electricPaid,
    waterAmount: waterAmt, waterPaidAmount: waterPaidAmt, waterPaid,
    otherAmount: otherAmt, otherPaidAmount: otherPaidAmt, otherLabel: data.otherLabel || null, otherPaid,
    balance, balancePaid,
    notes: data.notes || null,
  };

  const entry = await prisma.monthlyLedger.upsert({
    where: { tenantId_month: { tenantId, month } },
    update: shared,
    create: { tenantId, month, ...shared },
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
