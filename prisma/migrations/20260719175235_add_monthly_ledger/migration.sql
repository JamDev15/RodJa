-- CreateTable
CREATE TABLE "MonthlyLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "rentPaid" BOOLEAN NOT NULL DEFAULT false,
    "electricAmount" DOUBLE PRECISION,
    "electricPaid" BOOLEAN NOT NULL DEFAULT false,
    "waterAmount" DOUBLE PRECISION,
    "waterPaid" BOOLEAN NOT NULL DEFAULT false,
    "otherAmount" DOUBLE PRECISION,
    "otherLabel" TEXT,
    "otherPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyLedger_tenantId_month_key" ON "MonthlyLedger"("tenantId", "month");

-- AddForeignKey
ALTER TABLE "MonthlyLedger" ADD CONSTRAINT "MonthlyLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
