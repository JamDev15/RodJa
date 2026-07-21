-- AlterTable
ALTER TABLE "MonthlyLedger" ADD COLUMN     "balancePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "electricPaidAmount" DOUBLE PRECISION,
ADD COLUMN     "otherPaidAmount" DOUBLE PRECISION,
ADD COLUMN     "rentPaidAmount" DOUBLE PRECISION,
ADD COLUMN     "waterPaidAmount" DOUBLE PRECISION;
