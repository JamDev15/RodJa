-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "emailOwnerCopies" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "BillingRecord" ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "receiptNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_invoiceNumber_key" ON "BillingRecord"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_receiptNumber_key" ON "BillingRecord"("receiptNumber");
