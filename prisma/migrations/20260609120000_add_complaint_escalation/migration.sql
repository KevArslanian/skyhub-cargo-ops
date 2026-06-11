-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE 'escalated';

-- AlterTable
ALTER TABLE "PublicComplaint" ADD COLUMN "escalationDesk" TEXT;
ALTER TABLE "PublicComplaint" ADD COLUMN "escalationReason" TEXT;
ALTER TABLE "PublicComplaint" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "PublicComplaint" ADD COLUMN "escalatedById" TEXT;
ALTER TABLE "PublicComplaint" ADD COLUMN "escalatedByName" TEXT;

-- AddForeignKey
ALTER TABLE "PublicComplaint" ADD CONSTRAINT "PublicComplaint_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;