-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillReminder" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "billType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "ownerEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "ownerPushSent" BOOLEAN NOT NULL DEFAULT false,
    "tenantEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "BillReminder_ledgerId_billType_trigger_key" ON "BillReminder"("ledgerId", "billType", "trigger");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillReminder" ADD CONSTRAINT "BillReminder_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "MonthlyLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
