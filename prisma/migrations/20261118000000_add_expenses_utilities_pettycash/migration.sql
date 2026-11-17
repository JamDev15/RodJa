-- Phase 3: expenses, building utility bills and meters, petty cash.
-- Additive only: four new tables. No existing table or row is changed.

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "maintenanceRequestId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendor" TEXT,
    "amountCentavos" INTEGER NOT NULL,
    "incurredOn" DATE NOT NULL,
    "paidOn" DATE,
    "method" TEXT,
    "referenceNumber" TEXT,
    "receiptFileId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Expense_amount_check" CHECK ("amountCentavos" > 0)
);
CREATE UNIQUE INDEX "Expense_sourceId_key" ON "Expense"("sourceId");
CREATE INDEX "Expense_propertyId_incurredOn_idx" ON "Expense"("propertyId", "incurredOn");
CREATE INDEX "Expense_accountId_status_idx" ON "Expense"("accountId", "status");

CREATE TABLE "UtilityBill" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "utility" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "accountNumber" TEXT,
    "consumption" DECIMAL(12,3),
    "consumptionUnit" TEXT,
    "amountCentavos" INTEGER NOT NULL,
    "dueDate" DATE,
    "billFileId" TEXT,
    "expenseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "voidReason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UtilityBill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UtilityBill_amount_check" CHECK ("amountCentavos" > 0),
    CONSTRAINT "UtilityBill_consumption_check" CHECK ("consumption" IS NULL OR "consumption" >= 0)
);
CREATE UNIQUE INDEX "UtilityBill_expenseId_key" ON "UtilityBill"("expenseId");
CREATE INDEX "UtilityBill_propertyId_utility_billingMonth_idx" ON "UtilityBill"("propertyId", "utility", "billingMonth");

CREATE TABLE "MasterMeterReading" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "utility" TEXT NOT NULL,
    "meterLabel" TEXT NOT NULL,
    "readingDate" DATE NOT NULL,
    "value" DECIMAL(12,3) NOT NULL,
    "isMeterReset" BOOLEAN NOT NULL DEFAULT false,
    "previousReadingId" TEXT,
    "usage" DECIMAL(12,3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "notes" TEXT,
    "enteredBy" TEXT NOT NULL,
    "enteredByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterMeterReading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MasterMeterReading_value_check" CHECK ("value" >= 0)
);
CREATE INDEX "MasterMeterReading_meter_date_idx" ON "MasterMeterReading"("propertyId", "utility", "meterLabel", "readingDate");

CREATE TABLE "PettyCashTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "occurredOn" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "receiptFileId" TEXT,
    "expenseId" TEXT,
    "reference" TEXT,
    "reversalOfId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PettyCashTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PettyCashTransaction_amount_check" CHECK ("amountCentavos" <> 0),
    CONSTRAINT "PettyCashTransaction_sign_check" CHECK (
      ("kind" = 'TOP_UP' AND "amountCentavos" > 0)
      OR ("kind" = 'DISBURSEMENT' AND "amountCentavos" < 0)
      OR ("kind" IN ('COUNT_ADJUSTMENT', 'REVERSAL'))
    )
);
CREATE UNIQUE INDEX "PettyCashTransaction_expenseId_key" ON "PettyCashTransaction"("expenseId");
CREATE UNIQUE INDEX "PettyCashTransaction_reversalOfId_key" ON "PettyCashTransaction"("reversalOfId");
CREATE INDEX "PettyCashTransaction_propertyId_occurredOn_idx" ON "PettyCashTransaction"("propertyId", "occurredOn");
