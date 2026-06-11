-- DropForeignKey
ALTER TABLE "Airport" DROP CONSTRAINT "Airport_cityId_fkey";

-- DropForeignKey
ALTER TABLE "CargoItem" DROP CONSTRAINT "CargoItem_commodityId_fkey";

-- DropForeignKey
ALTER TABLE "Flight" DROP CONSTRAINT "Flight_destinationAirportId_fkey";

-- DropForeignKey
ALTER TABLE "Flight" DROP CONSTRAINT "Flight_originAirportId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_commodityId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_destinationAirportId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_originAirportId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_tariffId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentDetail" DROP CONSTRAINT "ShipmentDetail_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentItem" DROP CONSTRAINT "ShipmentItem_cargoItemId_fkey";

-- DropForeignKey
ALTER TABLE "ShipmentItem" DROP CONSTRAINT "ShipmentItem_shipmentId_fkey";

-- DropForeignKey
ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_destinationAirportId_fkey";

-- DropForeignKey
ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_originAirportId_fkey";

-- DropIndex
DROP INDEX "Flight_destinationAirportId_idx";

-- DropIndex
DROP INDEX "Flight_originAirportId_idx";

-- DropIndex
DROP INDEX "Shipment_commodityId_idx";

-- DropIndex
DROP INDEX "Shipment_destinationAirportId_idx";

-- DropIndex
DROP INDEX "Shipment_originAirportId_idx";

-- DropIndex
DROP INDEX "Shipment_tariffId_idx";

-- AlterTable
ALTER TABLE "Flight" DROP COLUMN "destinationAirportId",
DROP COLUMN "originAirportId";

-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "commodityId",
DROP COLUMN "destinationAirportId",
DROP COLUMN "originAirportId",
DROP COLUMN "tariffId";

-- AlterTable
ALTER TABLE "UserSetting" DROP COLUMN "defaultLandingPage",
DROP COLUMN "filterByOwnStation",
DROP COLUMN "language",
DROP COLUMN "timeFormat";

-- DropTable
DROP TABLE "Airport";

-- DropTable
DROP TABLE "CargoItem";

-- DropTable
DROP TABLE "City";

-- DropTable
DROP TABLE "ShipmentDetail";

-- DropTable
DROP TABLE "ShipmentItem";

-- DropTable
DROP TABLE "Tariff";

