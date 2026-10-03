-- CreateTable
CREATE TABLE "OwnerWorkflow" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB NOT NULL,
    "stopWhenPaid" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerWorkflowEnrollment" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "exitReason" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OwnerWorkflowEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerWorkflow_accountId_idx" ON "OwnerWorkflow"("accountId");

-- CreateIndex
CREATE INDEX "OwnerWorkflowEnrollment_status_nextRunAt_idx" ON "OwnerWorkflowEnrollment"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerWorkflowEnrollment_workflowId_tenantId_periodKey_key" ON "OwnerWorkflowEnrollment"("workflowId", "tenantId", "periodKey");

-- AddForeignKey
ALTER TABLE "OwnerWorkflow" ADD CONSTRAINT "OwnerWorkflow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerWorkflowEnrollment" ADD CONSTRAINT "OwnerWorkflowEnrollment_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OwnerWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerWorkflowEnrollment" ADD CONSTRAINT "OwnerWorkflowEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
