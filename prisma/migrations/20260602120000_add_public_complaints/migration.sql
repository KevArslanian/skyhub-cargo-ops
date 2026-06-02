-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('new', 'in_review', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintTopic" AS ENUM ('shipment', 'flight', 'document', 'service', 'other');

-- CreateTable
CREATE TABLE "PublicComplaint" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "topic" "ComplaintTopic" NOT NULL,
    "referenceNo" TEXT,
    "message" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'about-us',
    "handledById" TEXT,
    "handledByName" TEXT,
    "handledAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicComplaint_ticketCode_key" ON "PublicComplaint"("ticketCode");

-- CreateIndex
CREATE INDEX "PublicComplaint_status_createdAt_idx" ON "PublicComplaint"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PublicComplaint_topic_createdAt_idx" ON "PublicComplaint"("topic", "createdAt");

-- AddForeignKey
ALTER TABLE "PublicComplaint" ADD CONSTRAINT "PublicComplaint_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
