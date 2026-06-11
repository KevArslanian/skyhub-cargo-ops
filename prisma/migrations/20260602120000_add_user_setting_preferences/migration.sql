-- Baseline: applied on Neon 2026-06-02 (synced from production drift).
-- Legacy preference columns retained in DB; current Prisma schema uses timezone + accentColor subset.

ALTER TABLE "UserSetting" ADD COLUMN IF NOT EXISTS "defaultLandingPage" TEXT NOT NULL DEFAULT '/dashboard';
ALTER TABLE "UserSetting" ADD COLUMN IF NOT EXISTS "filterByOwnStation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSetting" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'id';
ALTER TABLE "UserSetting" ADD COLUMN IF NOT EXISTS "timeFormat" TEXT NOT NULL DEFAULT '24h';