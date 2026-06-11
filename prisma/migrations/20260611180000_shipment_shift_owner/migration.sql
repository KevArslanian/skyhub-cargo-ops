-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "shiftOwnerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "shiftOwnerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Shipment_shiftOwnerId_idx" ON "Shipment"("shiftOwnerId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Shipment_shiftOwnerId_fkey'
  ) THEN
    ALTER TABLE "Shipment"
      ADD CONSTRAINT "Shipment_shiftOwnerId_fkey"
      FOREIGN KEY ("shiftOwnerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill shift owner from creator when possible
UPDATE "Shipment"
SET "shiftOwnerId" = "createdById"
WHERE "shiftOwnerId" IS NULL AND "createdById" IS NOT NULL;