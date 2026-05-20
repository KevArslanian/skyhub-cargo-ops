-- Add SIWEB-ready master data tables and explicit shipment item junction table.

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "airlineCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacityKg" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "originAirportId" TEXT NOT NULL,
    "destinationAirportId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "minimumCharge" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentDetail" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "packagingType" TEXT NOT NULL,
    "insuranceValue" INTEGER NOT NULL,
    "declaredValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "shipmentId" TEXT NOT NULL,
    "cargoItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "declaredValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("shipmentId","cargoItemId")
);

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN "aircraftId" TEXT,
ADD COLUMN "originAirportId" TEXT,
ADD COLUMN "destinationAirportId" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "commodityId" TEXT,
ADD COLUMN "originAirportId" TEXT,
ADD COLUMN "destinationAirportId" TEXT,
ADD COLUMN "tariffId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "City_code_key" ON "City"("code");
CREATE UNIQUE INDEX "Airport_code_key" ON "Airport"("code");
CREATE INDEX "Airport_cityId_idx" ON "Airport"("cityId");
CREATE UNIQUE INDEX "Aircraft_registration_key" ON "Aircraft"("registration");
CREATE UNIQUE INDEX "Commodity_code_key" ON "Commodity"("code");
CREATE UNIQUE INDEX "Tariff_code_key" ON "Tariff"("code");
CREATE INDEX "Tariff_originAirportId_destinationAirportId_idx" ON "Tariff"("originAirportId", "destinationAirportId");
CREATE UNIQUE INDEX "CargoItem_sku_key" ON "CargoItem"("sku");
CREATE INDEX "CargoItem_commodityId_idx" ON "CargoItem"("commodityId");
CREATE UNIQUE INDEX "ShipmentDetail_shipmentId_key" ON "ShipmentDetail"("shipmentId");
CREATE INDEX "ShipmentItem_cargoItemId_idx" ON "ShipmentItem"("cargoItemId");
CREATE INDEX "Flight_aircraftId_idx" ON "Flight"("aircraftId");
CREATE INDEX "Flight_originAirportId_idx" ON "Flight"("originAirportId");
CREATE INDEX "Flight_destinationAirportId_idx" ON "Flight"("destinationAirportId");
CREATE INDEX "Shipment_commodityId_idx" ON "Shipment"("commodityId");
CREATE INDEX "Shipment_originAirportId_idx" ON "Shipment"("originAirportId");
CREATE INDEX "Shipment_destinationAirportId_idx" ON "Shipment"("destinationAirportId");
CREATE INDEX "Shipment_tariffId_idx" ON "Shipment"("tariffId");

-- AddForeignKey
ALTER TABLE "Airport" ADD CONSTRAINT "Airport_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CargoItem" ADD CONSTRAINT "CargoItem_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "Airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentDetail" ADD CONSTRAINT "ShipmentDetail_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_cargoItemId_fkey" FOREIGN KEY ("cargoItemId") REFERENCES "CargoItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
