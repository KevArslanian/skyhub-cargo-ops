CREATE TABLE "SystemKpi" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "platformUptime" DOUBLE PRECISION NOT NULL DEFAULT 99.98,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemKpi_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SystemKpi" ("id", "platformUptime", "updatedAt")
VALUES ('global', 99.98, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
