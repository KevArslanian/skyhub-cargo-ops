-- Add CRUDS cargo fields required by SIWEB UGD.

ALTER TABLE "Aircraft"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Pesawat Operasional',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Aktif';

ALTER TABLE "Shipment"
  ADD COLUMN "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "cargoMode" TEXT NOT NULL DEFAULT 'Udara',
  ADD COLUMN "senderPhone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "serviceType" TEXT NOT NULL DEFAULT 'Biasa',
  ADD COLUMN "shippingRate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "vehicleName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "vehicleType" TEXT NOT NULL DEFAULT 'Pesawat',
  ADD COLUMN "vehicleCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "vehicleCapacityKg" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "vehicleStatus" TEXT NOT NULL DEFAULT 'Aktif',
  ADD COLUMN "goodsStatus" TEXT NOT NULL DEFAULT 'Diproses',
  ADD COLUMN "transactionStatus" TEXT NOT NULL DEFAULT 'Pending';

UPDATE "Shipment"
SET
  "sentAt" = COALESCE("sentAt", "receivedAt"),
  "cargoMode" = COALESCE(NULLIF("cargoMode", ''), 'Udara'),
  "vehicleType" = COALESCE(NULLIF("vehicleType", ''), 'Pesawat'),
  "vehicleStatus" = COALESCE(NULLIF("vehicleStatus", ''), 'Aktif'),
  "goodsStatus" = COALESCE(NULLIF("goodsStatus", ''), 'Diproses'),
  "transactionStatus" = COALESCE(NULLIF("transactionStatus", ''), 'Pending');
