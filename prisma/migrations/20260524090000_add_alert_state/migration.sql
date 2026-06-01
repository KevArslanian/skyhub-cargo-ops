-- CreateEnum
CREATE TYPE "AlertWorkflowStatus" AS ENUM ('open', 'acknowledged', 'snoozed', 'resolved');

-- CreateTable
CREATE TABLE "AlertState" (
  "id" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" "AlertWorkflowStatus" NOT NULL DEFAULT 'open',
  "assignedToId" TEXT,
  "assignedToName" TEXT,
  "acknowledgedById" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "note" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlertState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertState_alertKey_key" ON "AlertState"("alertKey");

-- CreateIndex
CREATE INDEX "AlertState_status_updatedAt_idx" ON "AlertState"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AlertState_assignedToId_idx" ON "AlertState"("assignedToId");

-- CreateIndex
CREATE INDEX "AlertState_entityType_entityId_idx" ON "AlertState"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "AlertState" ADD CONSTRAINT "AlertState_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertState" ADD CONSTRAINT "AlertState_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertState" ADD CONSTRAINT "AlertState_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
