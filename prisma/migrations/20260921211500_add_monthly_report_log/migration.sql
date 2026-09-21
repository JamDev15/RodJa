-- CreateTable
CREATE TABLE "MonthlyReportLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyReportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReportLog_accountId_monthKey_key" ON "MonthlyReportLog"("accountId", "monthKey");

-- AddForeignKey
ALTER TABLE "MonthlyReportLog" ADD CONSTRAINT "MonthlyReportLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
