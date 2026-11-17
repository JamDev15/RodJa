-- Phase 1 follow-ups + Phase 2 (tenancy lifecycle and operations).
-- Additive only: new tables, new nullable/defaulted columns, and one
-- relaxed constraint (MaintenanceRequest.tenantId becomes nullable so
-- administrators can log common-area work orders). No existing row is
-- modified or backfilled.

-- BillingProfile: proration and repeating-penalty settings (both off by default)
ALTER TABLE "BillingProfile" ADD COLUMN "penaltyMaxRepeats" INTEGER;
ALTER TABLE "BillingProfile" ADD COLUMN "prorationPolicy" TEXT NOT NULL DEFAULT 'NONE';

-- RentPayment: receipt email tracking
ALTER TABLE "RentPayment" ADD COLUMN "receiptEmailedAt" TIMESTAMP(3);

-- Notice: property-scoped announcements
ALTER TABLE "Notice" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Notice" ADD COLUMN "createdBy" TEXT;

-- MaintenanceRequest: assignment, scoping and history
ALTER TABLE "MaintenanceRequest" ALTER COLUMN "tenantId" DROP NOT NULL;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "accountId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "unitId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "category" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "source" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "closedAt" TIMESTAMP(3);
CREATE INDEX "MaintenanceRequest_accountId_status_idx" ON "MaintenanceRequest"("accountId", "status");
CREATE INDEX "MaintenanceRequest_assignedToId_idx" ON "MaintenanceRequest"("assignedToId");

CREATE TABLE "Occupant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "relationship" TEXT,
    "phone" TEXT,
    "idFileId" TEXT,
    "photoFileId" TEXT,
    "movedInOn" DATE NOT NULL,
    "movedOutOn" DATE,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Occupant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Occupant_dates_check" CHECK ("movedOutOn" IS NULL OR "movedOutOn" >= "movedInOn")
);
CREATE INDEX "Occupant_tenantId_idx" ON "Occupant"("tenantId");

CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChecklistTemplate_accountId_kind_idx" ON "ChecklistTemplate"("accountId", "kind");

CREATE TABLE "TenancyChecklist" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenancyChecklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenancyChecklist_tenantId_kind_key" ON "TenancyChecklist"("tenantId", "kind");

CREATE TABLE "TenancyChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,
    "note" TEXT,
    "photoFileId" TEXT,
    CONSTRAINT "TenancyChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TenancyChecklistItem_checklistId_idx" ON "TenancyChecklistItem"("checklistId");

CREATE TABLE "DepositTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fund" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,
    "occurredOn" DATE NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "reason" TEXT,
    "paymentId" TEXT,
    "reversalOfId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DepositTransaction_amount_check" CHECK ("amountCentavos" <> 0),
    CONSTRAINT "DepositTransaction_sign_check" CHECK (
      ("kind" = 'RECEIVED' AND "amountCentavos" > 0)
      OR ("kind" IN ('APPLIED', 'REFUNDED', 'FORFEITED') AND "amountCentavos" < 0)
      OR ("kind" = 'REVERSAL')
    )
);
CREATE UNIQUE INDEX "DepositTransaction_reversalOfId_key" ON "DepositTransaction"("reversalOfId");
CREATE INDEX "DepositTransaction_tenantId_fund_idx" ON "DepositTransaction"("tenantId", "fund");

CREATE TABLE "LeaseTerm" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyRentCentavos" INTEGER,
    "renewalOfId" TEXT,
    "notes" TEXT,
    "expiryNoticeSentAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaseTerm_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeaseTerm_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
    CONSTRAINT "LeaseTerm_rent_check" CHECK ("monthlyRentCentavos" IS NULL OR "monthlyRentCentavos" >= 0)
);
CREATE UNIQUE INDEX "LeaseTerm_renewalOfId_key" ON "LeaseTerm"("renewalOfId");
CREATE INDEX "LeaseTerm_tenantId_idx" ON "LeaseTerm"("tenantId");

CREATE TABLE "LeaseDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseTermId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaseDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaseDocument_tenantId_idx" ON "LeaseDocument"("tenantId");

CREATE TABLE "MoveOut" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "noticeDate" DATE,
    "plannedDate" DATE NOT NULL,
    "actualDate" DATE,
    "reason" TEXT,
    "inspectionNotes" TEXT,
    "inspectionPhotoIds" JSONB,
    "inspectedAt" TIMESTAMP(3),
    "inspectedBy" TEXT,
    "finalReadingId" TEXT,
    "outstandingAtCloseCentavos" INTEGER,
    "outstandingNote" TEXT,
    "vacancyApprovedAt" TIMESTAMP(3),
    "vacancyApprovedBy" TEXT,
    "cancelledReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MoveOut_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MoveOut_tenantId_key" ON "MoveOut"("tenantId");

CREATE TABLE "MaintenanceUpdate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "statusFrom" TEXT,
    "statusTo" TEXT,
    "assignedToId" TEXT,
    "note" TEXT,
    "photoFileIds" JSONB,
    "visibleToTenant" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceUpdate_requestId_createdAt_idx" ON "MaintenanceUpdate"("requestId", "createdAt");

CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSenderRole" TEXT,
    "adminReadAt" TIMESTAMP(3),
    "tenantReadAt" TIMESTAMP(3),
    "ownerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MessageThread_accountId_lastMessageAt_idx" ON "MessageThread"("accountId", "lastMessageAt");
CREATE INDEX "MessageThread_tenantId_idx" ON "MessageThread"("tenantId");

CREATE TABLE "ThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThreadMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ThreadMessage_threadId_createdAt_idx" ON "ThreadMessage"("threadId", "createdAt");

-- Foreign keys
ALTER TABLE "Occupant" ADD CONSTRAINT "Occupant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenancyChecklist" ADD CONSTRAINT "TenancyChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenancyChecklistItem" ADD CONSTRAINT "TenancyChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "TenancyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaseTerm" ADD CONSTRAINT "LeaseTerm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaseDocument" ADD CONSTRAINT "LeaseDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoveOut" ADD CONSTRAINT "MoveOut_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceUpdate" ADD CONSTRAINT "MaintenanceUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
