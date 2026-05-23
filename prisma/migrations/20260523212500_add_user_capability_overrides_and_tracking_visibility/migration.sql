-- Additive access-control overrides. Existing role defaults remain handled in app code.
CREATE TABLE "UserCapabilityOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserCapabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCapabilityOverride_userId_capability_key" ON "UserCapabilityOverride"("userId", "capability");
CREATE INDEX "UserCapabilityOverride_capability_idx" ON "UserCapabilityOverride"("capability");

ALTER TABLE "UserCapabilityOverride"
  ADD CONSTRAINT "UserCapabilityOverride_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackingLog"
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN "actorUserId" TEXT;

CREATE INDEX "TrackingLog_visibility_createdAt_idx" ON "TrackingLog"("visibility", "createdAt");
CREATE INDEX "TrackingLog_actorUserId_idx" ON "TrackingLog"("actorUserId");

ALTER TABLE "TrackingLog"
  ADD CONSTRAINT "TrackingLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
