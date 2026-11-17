// Permanently deletes a landlord account and everything in it. Used by the
// super-admin console and by the owner's own "Delete my account" (required
// by the App Store and Google Play for apps that offer accounts).
//
// Order matters — children before parents — because most relations are
// deliberately not onDelete: Cascade (financial history is Restrict-protected
// from accidental deletion from any other path). Models with a cascading
// Account relation (PushSubscription, MessageLog, Automation, Contract,
// Invoice, workflows, BillingProfile, …) go with the account row itself.

import { prisma } from "@/lib/prisma";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.COLLECTIONS_BUCKET ?? "collections-private";

export async function deleteAccountData(id: string): Promise<void> {
  const tenantIds = (await prisma.tenant.findMany({ where: { unit: { property: { accountId: id } } }, select: { id: true } })).map((t) => t.id);
  const objectPaths = (await prisma.storedFile.findMany({ where: { accountId: id, storage: "SUPABASE_PRIVATE" }, select: { objectPath: true } })).map((f) => f.objectPath).filter(Boolean) as string[];
  const scoped = { accountId: id };

  await prisma.$transaction([
    // Collections billing
    prisma.paymentAllocation.deleteMany({ where: { payment: scoped } }),
    prisma.chargeAdjustment.deleteMany({ where: scoped }),
    prisma.waterExcessProposal.deleteMany({ where: scoped }),
    prisma.rentPayment.deleteMany({ where: scoped }),
    prisma.charge.deleteMany({ where: scoped }),
    prisma.statement.deleteMany({ where: scoped }),
    prisma.vecoReceipt.deleteMany({ where: scoped }),
    prisma.vecoReminderLog.deleteMany({ where: { tenantId: { in: tenantIds } } }),
    prisma.meterReading.deleteMany({ where: scoped }),
    prisma.recurringCharge.deleteMany({ where: scoped }),
    prisma.storedFile.deleteMany({ where: scoped }),
    prisma.billingAuditLog.deleteMany({ where: scoped }),
    prisma.payment.deleteMany({ where: { tenant: { unit: { property: scoped } } } }),
    // Operations
    prisma.maintenanceUpdate.deleteMany({ where: { request: { OR: [scoped, { tenant: { unit: { property: scoped } } }] } } }),
    prisma.maintenanceRequest.deleteMany({ where: { OR: [scoped, { tenant: { unit: { property: scoped } } }] } }),
    prisma.threadMessage.deleteMany({ where: { thread: scoped } }),
    prisma.messageThread.deleteMany({ where: scoped }),
    prisma.occupant.deleteMany({ where: scoped }),
    prisma.tenancyChecklist.deleteMany({ where: scoped }),
    prisma.checklistTemplate.deleteMany({ where: scoped }),
    prisma.depositTransaction.deleteMany({ where: scoped }),
    prisma.leaseDocument.deleteMany({ where: scoped }),
    prisma.leaseTerm.deleteMany({ where: scoped }),
    prisma.moveOut.deleteMany({ where: scoped }),
    // Finance
    prisma.pettyCashTransaction.deleteMany({ where: scoped }),
    prisma.utilityBill.deleteMany({ where: scoped }),
    prisma.expense.deleteMany({ where: scoped }),
    prisma.masterMeterReading.deleteMany({ where: scoped }),
    // Messaging integrations and devices
    prisma.messengerLink.deleteMany({ where: scoped }),
    prisma.messengerPage.deleteMany({ where: scoped }),
    prisma.facebookConnectRequest.deleteMany({ where: scoped }),
    prisma.deviceToken.deleteMany({ where: scoped }),
    // Core
    prisma.reminder.deleteMany({ where: { tenant: { unit: { property: scoped } } } }),
    prisma.notice.deleteMany({ where: scoped }),
    prisma.tenant.deleteMany({ where: { unit: { property: scoped } } }),
    prisma.unit.deleteMany({ where: { property: scoped } }),
    prisma.property.deleteMany({ where: scoped }),
    prisma.billingRecord.deleteMany({ where: scoped }),
    prisma.user.deleteMany({ where: scoped }),
    prisma.reminderConfig.deleteMany({ where: scoped }),
    prisma.loginToken.deleteMany({ where: scoped }),
    prisma.account.delete({ where: { id } }),
  ]);

  // Private files in Supabase Storage (best effort, after the database commit).
  if (SUPABASE_URL && SUPABASE_KEY && objectPaths.length) {
    for (let i = 0; i < objectPaths.length; i += 100) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: objectPaths.slice(i, i + 100) }),
      }).catch((err) => console.error("Deleting stored files failed:", err));
    }
  }
}
