-- Facebook Messenger notifications: one new table, plus a nullable column on
-- ThreadMessage (added in the Phase 2 migration). Nothing existing changes.
CREATE TABLE "MessengerLink" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "unlinkedAt" TIMESTAMP(3),
    CONSTRAINT "MessengerLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MessengerLink_kind_check" CHECK (("kind" = 'TENANT' AND "tenantId" IS NOT NULL) OR ("kind" = 'ADMIN' AND "userId" IS NOT NULL))
);
CREATE UNIQUE INDEX "MessengerLink_pageId_psid_key" ON "MessengerLink"("pageId", "psid");
CREATE INDEX "MessengerLink_tenantId_idx" ON "MessengerLink"("tenantId");
CREATE INDEX "MessengerLink_accountId_kind_idx" ON "MessengerLink"("accountId", "kind");

ALTER TABLE "ThreadMessage" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "ThreadMessage_externalId_key" ON "ThreadMessage"("externalId");
