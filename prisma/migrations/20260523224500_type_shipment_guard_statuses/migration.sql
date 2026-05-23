CREATE TYPE "ShipmentTransactionStatus" AS ENUM (
  'Belum_Lunas',
  'Menunggu_Verifikasi',
  'Lunas',
  'Tidak_Ditagih',
  'Pending'
);

CREATE TYPE "ShipmentDocStatus" AS ENUM (
  'Complete',
  'Partial',
  'Review'
);

CREATE TYPE "ShipmentReadiness" AS ENUM (
  'Ready',
  'Pending'
);

UPDATE "Shipment"
SET "transactionStatus" = CASE
  WHEN "transactionStatus" IN ('Belum_Lunas', 'Belum Lunas') THEN 'Belum_Lunas'
  WHEN "transactionStatus" IN ('Menunggu_Verifikasi', 'Menunggu Verifikasi') THEN 'Menunggu_Verifikasi'
  WHEN "transactionStatus" = 'Lunas' THEN 'Lunas'
  WHEN "transactionStatus" IN ('Tidak_Ditagih', 'Tidak Ditagih') THEN 'Tidak_Ditagih'
  WHEN "transactionStatus" = 'Pending' THEN 'Pending'
  ELSE 'Belum_Lunas'
END;

UPDATE "Shipment"
SET "docStatus" = CASE
  WHEN "docStatus" = 'Complete' THEN 'Complete'
  WHEN "docStatus" = 'Partial' THEN 'Partial'
  WHEN "docStatus" = 'Review' THEN 'Review'
  ELSE 'Review'
END;

UPDATE "Shipment"
SET "readiness" = CASE
  WHEN "readiness" = 'Ready' THEN 'Ready'
  WHEN "readiness" = 'Pending' THEN 'Pending'
  ELSE 'Pending'
END;

ALTER TABLE "Shipment"
  ALTER COLUMN "transactionStatus" DROP DEFAULT,
  ALTER COLUMN "transactionStatus" TYPE "ShipmentTransactionStatus" USING "transactionStatus"::"ShipmentTransactionStatus",
  ALTER COLUMN "transactionStatus" SET DEFAULT 'Belum_Lunas',
  ALTER COLUMN "docStatus" DROP DEFAULT,
  ALTER COLUMN "docStatus" TYPE "ShipmentDocStatus" USING "docStatus"::"ShipmentDocStatus",
  ALTER COLUMN "docStatus" SET DEFAULT 'Complete',
  ALTER COLUMN "readiness" DROP DEFAULT,
  ALTER COLUMN "readiness" TYPE "ShipmentReadiness" USING "readiness"::"ShipmentReadiness",
  ALTER COLUMN "readiness" SET DEFAULT 'Ready';
