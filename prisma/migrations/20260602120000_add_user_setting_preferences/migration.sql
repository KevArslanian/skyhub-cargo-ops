-- AlterTable
ALTER TABLE "UserSetting" ADD COLUMN "defaultLandingPage" TEXT NOT NULL DEFAULT 'dashboard';
ALTER TABLE "UserSetting" ADD COLUMN "filterByOwnStation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSetting" ADD COLUMN "timeFormat" TEXT NOT NULL DEFAULT '24h';
ALTER TABLE "UserSetting" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'id';
