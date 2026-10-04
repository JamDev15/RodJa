import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/owner-auth";
import { ownerWorkflowEnrollSchema, formatZodError } from "@/lib/validations";
import { enrollTenant } from "@/lib/owner-workflows";
import { monthKeyOf, toPhDateOnly } from "@/lib/due-dates";

/** Manually start a workflow for selected tenants (bill month = current month). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const w = await prisma.ownerWorkflow.findFirst({ where: { id, accountId } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!w.isActive) return NextResponse.json({ error: "Turn this workflow on first" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = ownerWorkflowEnrollSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: parsed.data.tenantIds }, isActive: true, unit: { property: { accountId } } },
    select: { id: true },
  });
  const now = new Date();
  // One manual start per tenant per day — protects against double clicks.
  const periodKey = `manual:${toPhDateOnly(now).toISOString().slice(0, 10)}`;
  let started = 0;
  for (const t of tenants) if (await enrollTenant(w.id, t.id, periodKey, monthKeyOf(now))) started++;
  return NextResponse.json({ started, skipped: parsed.data.tenantIds.length - started });
}
