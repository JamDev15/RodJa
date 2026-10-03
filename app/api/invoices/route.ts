import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSendSchema, formatZodError } from "@/lib/validations";
import { invoiceItemsFromLedger, issueDocument, receiptItemsFromLedger } from "@/lib/invoices";

/** Owner sends an invoice (what's still owed) or a receipt (what's been paid) for one ledger month. */
export async function POST(req: Request) {
  const session = await auth();
  const accountId = (session?.user as any)?.accountId;
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const parsed = invoiceSendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const ledger = await prisma.monthlyLedger.findFirst({
    where: { id: parsed.data.ledgerId, tenant: { unit: { property: { accountId } } } },
    include: { tenant: { include: { unit: { include: { property: { include: { account: true } } } } } } },
  });
  if (!ledger) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const type = parsed.data.type;
  const items = type === "invoice" ? invoiceItemsFromLedger(ledger) : receiptItemsFromLedger(ledger);
  if (items.length === 0) {
    return NextResponse.json(
      { error: type === "invoice" ? "Nothing is unpaid for this month." : "Nothing has been marked paid for this month yet." },
      { status: 400 }
    );
  }

  const { invoice, emailed } = await issueDocument({
    account: ledger.tenant.unit.property.account,
    tenant: ledger.tenant,
    type,
    items,
    month: ledger.month,
    ledgerId: ledger.id,
    notes: parsed.data.notes,
  });
  return NextResponse.json({ id: invoice.id, number: invoice.number, emailed, hasEmail: !!ledger.tenant.email }, { status: 201 });
}
