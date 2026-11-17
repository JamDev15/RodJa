-- Per-account Facebook Page connections and native-app push tokens.
-- Additive: three new tables. Nothing existing changes.
CREATE TABLE "MessengerPage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageUsername" TEXT,
    "pageTokenEnc" TEXT NOT NULL,
    "connectedByFbUserId" TEXT,
    "connectedBy" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantTemplateName" TEXT,
    "tenantTemplateStatus" TEXT,
    "officeTemplateName" TEXT,
    "officeTemplateStatus" TEXT,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessengerPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MessengerPage_accountId_key" ON "MessengerPage"("accountId");
CREATE UNIQUE INDEX "MessengerPage_pageId_key" ON "MessengerPage"("pageId");

CREATE TABLE "FacebookConnectRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fbUserId" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacebookConnectRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FacebookConnectRequest_accountId_idx" ON "FacebookConnectRequest"("accountId");

CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeviceToken_platform_check" CHECK ("platform" IN ('ios', 'android'))
);
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_tenantId_idx" ON "DeviceToken"("tenantId");
CREATE INDEX "DeviceToken_accountId_kind_idx" ON "DeviceToken"("accountId", "kind");
