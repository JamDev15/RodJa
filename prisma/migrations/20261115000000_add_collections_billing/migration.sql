-- Collections billing (twice-monthly statements, verified payments, water,
-- VECO receipts, caretaker meter entry).
--
-- Additive only: new tables plus three nullable/defaulted Tenant columns.
-- No existing table, column, or row is changed or removed, so every current
-- property keeps working on MonthlyLedger/Payment exactly as before. A
-- property only uses the new tables once an administrator creates and
-- enables its BillingProfile. All money columns here are integer centavos.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "occupantCount" INTEGER,
ADD COLUMN "penaltyExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "penaltyExemptReason" TEXT;

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "cycles" JSONB NOT NULL,
    "shortMonthPolicy" TEXT NOT NULL DEFAULT 'LAST_DAY',
    "generateDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "distributeDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "dueDaysAfter" INTEGER NOT NULL DEFAULT 0,
    "monthlyCycleKey" TEXT NOT NULL DEFAULT 'A',
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "requireReview" BOOLEAN NOT NULL DEFAULT true,
    "waterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "waterBaseCentavos" INTEGER NOT NULL DEFAULT 35000,
    "waterPerExtraCentavos" INTEGER NOT NULL DEFAULT 20000,
    "waterMaxOccupants" INTEGER NOT NULL DEFAULT 4,
    "penaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "penaltyRateBps" INTEGER,
    "penaltyGraceDays" INTEGER,
    "penaltyBasis" TEXT NOT NULL DEFAULT 'STATEMENT_UNPAID_CHARGES',
    "penaltyRepeat" TEXT NOT NULL DEFAULT 'ONCE',
    "meterUnitLabel" TEXT NOT NULL DEFAULT 'm³',
    "meterAllowance" DECIMAL(12,3),
    "meterExcessRateCentavos" INTEGER,
    "meterReadingFrequency" TEXT,
    "vecoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vecoReceiptDueDay" INTEGER NOT NULL DEFAULT 10,
    "paymentInstructions" TEXT,
    "logoFileId" TEXT,
    "statementPrefix" TEXT NOT NULL DEFAULT 'SOA',
    "nextStatementNumber" INTEGER NOT NULL DEFAULT 1,
    "receiptPrefix" TEXT NOT NULL DEFAULT 'PR',
    "nextReceiptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBilling" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "meterId" TEXT,
    "vecoAccountNumber" TEXT,
    "waterOverrideCentavos" INTEGER,
    "waterOverrideReason" TEXT,
    "waterOverrideBy" TEXT,
    "waterOverrideAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringCharge" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "amountBasis" TEXT NOT NULL DEFAULT 'PER_OCCURRENCE',
    "frequency" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "cycleKey" TEXT,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "cycleDate" DATE NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "generateOn" DATE NOT NULL,
    "distributeOn" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "previousBalanceCentavos" INTEGER,
    "unappliedCreditCentavos" INTEGER,
    "currentChargesCentavos" INTEGER,
    "penaltiesCentavos" INTEGER,
    "totalDueCentavos" INTEGER,
    "snapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "statementId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "periodKey" TEXT,
    "dueDate" DATE NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceId" TEXT,
    "calc" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Charge_amount_positive" CHECK ("amountCentavos" > 0)
);

-- CreateTable
CREATE TABLE "ChargeAdjustment" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "ChargeAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChargeAdjustment_amount_negative" CHECK ("amountCentavos" < 0)
);

-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "paidOn" DATE NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "proofFileId" TEXT,
    "proofSha256" TEXT,
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "reversedBy" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentPayment_amount_positive" CHECK ("amountCentavos" > 0)
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amountCentavos" > 0)
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingDate" DATE NOT NULL,
    "value" DECIMAL(12,3) NOT NULL,
    "isMeterReset" BOOLEAN NOT NULL DEFAULT false,
    "previousReadingId" TEXT,
    "usage" DECIMAL(12,3),
    "overAllowance" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "notes" TEXT,
    "enteredBy" TEXT NOT NULL,
    "enteredByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MeterReading_value_nonnegative" CHECK ("value" >= 0)
);

-- CreateTable
CREATE TABLE "WaterExcessProposal" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT,
    "readingId" TEXT NOT NULL,
    "usage" DECIMAL(12,3) NOT NULL,
    "allowance" DECIMAL(12,3) NOT NULL,
    "excessUnits" DECIMAL(12,3) NOT NULL,
    "rateCentavos" INTEGER NOT NULL,
    "proposedCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "chargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterExcessProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VecoReceipt" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "vecoAccountNumber" TEXT,
    "amountCentavos" INTEGER,
    "paidOn" DATE,
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VecoReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VecoReminderLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VecoReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "purpose" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "objectPath" TEXT,
    "data" BYTEA,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAuditLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaretakerProperty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaretakerProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_propertyId_key" ON "BillingProfile"("propertyId");

-- CreateIndex
CREATE INDEX "BillingProfile_accountId_idx" ON "BillingProfile"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBilling_unitId_key" ON "RoomBilling"("unitId");

-- CreateIndex
CREATE INDEX "RecurringCharge_unitId_idx" ON "RecurringCharge"("unitId");

-- CreateIndex
CREATE INDEX "RecurringCharge_propertyId_idx" ON "RecurringCharge"("propertyId");

-- CreateIndex
CREATE INDEX "Statement_propertyId_periodKey_idx" ON "Statement"("propertyId", "periodKey");

-- CreateIndex
CREATE INDEX "Statement_accountId_status_idx" ON "Statement"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_tenantId_periodKey_key" ON "Statement"("tenantId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_propertyId_number_key" ON "Statement"("propertyId", "number");

-- CreateIndex
CREATE INDEX "Charge_tenantId_status_idx" ON "Charge"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Charge_statementId_idx" ON "Charge"("statementId");

-- CreateIndex
CREATE INDEX "Charge_propertyId_billingMonth_idx" ON "Charge"("propertyId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_tenantId_sourceKey_key" ON "Charge"("tenantId", "sourceKey");

-- CreateIndex
CREATE INDEX "ChargeAdjustment_chargeId_idx" ON "ChargeAdjustment"("chargeId");

-- CreateIndex
CREATE INDEX "RentPayment_tenantId_status_idx" ON "RentPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RentPayment_propertyId_status_idx" ON "RentPayment"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_tenantId_clientRequestId_key" ON "RentPayment"("tenantId", "clientRequestId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_chargeId_idx" ON "PaymentAllocation"("chargeId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_idx" ON "PaymentAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "MeterReading_unitId_readingDate_idx" ON "MeterReading"("unitId", "readingDate");

-- CreateIndex
CREATE INDEX "MeterReading_propertyId_readingDate_idx" ON "MeterReading"("propertyId", "readingDate");

-- CreateIndex
CREATE UNIQUE INDEX "WaterExcessProposal_readingId_key" ON "WaterExcessProposal"("readingId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterExcessProposal_chargeId_key" ON "WaterExcessProposal"("chargeId");

-- CreateIndex
CREATE INDEX "WaterExcessProposal_propertyId_status_idx" ON "WaterExcessProposal"("propertyId", "status");

-- CreateIndex
CREATE INDEX "VecoReceipt_tenantId_billingMonth_idx" ON "VecoReceipt"("tenantId", "billingMonth");

-- CreateIndex
CREATE INDEX "VecoReceipt_propertyId_status_idx" ON "VecoReceipt"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VecoReminderLog_tenantId_billingMonth_channel_key" ON "VecoReminderLog"("tenantId", "billingMonth", "channel");

-- CreateIndex
CREATE INDEX "StoredFile_accountId_purpose_idx" ON "StoredFile"("accountId", "purpose");

-- CreateIndex
CREATE INDEX "StoredFile_tenantId_sha256_idx" ON "StoredFile"("tenantId", "sha256");

-- CreateIndex
CREATE INDEX "BillingAuditLog_accountId_createdAt_idx" ON "BillingAuditLog"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAuditLog_entityType_entityId_idx" ON "BillingAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BillingAuditLog_tenantId_createdAt_idx" ON "BillingAuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaretakerProperty_userId_propertyId_key" ON "CaretakerProperty"("userId", "propertyId");

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBilling" ADD CONSTRAINT "RoomBilling_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeAdjustment" ADD CONSTRAINT "ChargeAdjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "RentPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterExcessProposal" ADD CONSTRAINT "WaterExcessProposal_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VecoReceipt" ADD CONSTRAINT "VecoReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaretakerProperty" ADD CONSTRAINT "CaretakerProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaretakerProperty" ADD CONSTRAINT "CaretakerProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
