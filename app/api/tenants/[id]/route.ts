import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tenantUpdateSchema, formatZodError } from "@/lib/validations";
import { applyTenantUpdate, PhoneTakenError } from "@/lib/tenants";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findFirst({
    where: { id, unit: { property: { accountId } } },
    include: { unit: { include: { property: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Never send the PIN hash to the client — it's a one-way hash and has no
  // legitimate use in the browser; exposing it also invites offline
  // brute-forcing of what's usually a short numeric PIN.
  const { portalPin: _portalPin, ...tenantWithoutPin } = tenant;
  return NextResponse.json(tenantWithoutPin);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findFirst({ where: { id, unit: { property: { accountId } } } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = tenantUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  let updated;
  try {
    updated = await applyTenantUpdate(id, tenant.phone, parsed.data);
  } catch (err) {
    if (err instanceof PhoneTakenError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  return NextResponse.json(updated);
}
