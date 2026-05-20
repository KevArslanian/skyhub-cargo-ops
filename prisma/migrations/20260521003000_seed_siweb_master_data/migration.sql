-- Seed SIWEB master data and connect existing operational rows without deleting user data.

INSERT INTO "City" ("id", "code", "name", "province", "updatedAt") VALUES
  ('city-soq', 'SOQ', 'Sorong', 'Papua Barat Daya', CURRENT_TIMESTAMP),
  ('city-cgk', 'CGK', 'Tangerang', 'Banten', CURRENT_TIMESTAMP),
  ('city-sub', 'SUB', 'Surabaya', 'Jawa Timur', CURRENT_TIMESTAMP),
  ('city-dps', 'DPS', 'Denpasar', 'Bali', CURRENT_TIMESTAMP),
  ('city-upg', 'UPG', 'Makassar', 'Sulawesi Selatan', CURRENT_TIMESTAMP),
  ('city-bpn', 'BPN', 'Balikpapan', 'Kalimantan Timur', CURRENT_TIMESTAMP),
  ('city-kno', 'KNO', 'Deli Serdang', 'Sumatera Utara', CURRENT_TIMESTAMP),
  ('city-plm', 'PLM', 'Palembang', 'Sumatera Selatan', CURRENT_TIMESTAMP),
  ('city-pnk', 'PNK', 'Pontianak', 'Kalimantan Barat', CURRENT_TIMESTAMP),
  ('city-bdo', 'BDO', 'Bandung', 'Jawa Barat', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Airport" ("id", "code", "name", "cityId", "updatedAt") VALUES
  ('airport-soq', 'SOQ', 'Domine Eduard Osok', 'city-soq', CURRENT_TIMESTAMP),
  ('airport-cgk', 'CGK', 'Soekarno-Hatta', 'city-cgk', CURRENT_TIMESTAMP),
  ('airport-sub', 'SUB', 'Juanda', 'city-sub', CURRENT_TIMESTAMP),
  ('airport-dps', 'DPS', 'I Gusti Ngurah Rai', 'city-dps', CURRENT_TIMESTAMP),
  ('airport-upg', 'UPG', 'Sultan Hasanuddin', 'city-upg', CURRENT_TIMESTAMP),
  ('airport-bpn', 'BPN', 'Sultan Aji Muhammad Sulaiman Sepinggan', 'city-bpn', CURRENT_TIMESTAMP),
  ('airport-kno', 'KNO', 'Kualanamu', 'city-kno', CURRENT_TIMESTAMP),
  ('airport-plm', 'PLM', 'Sultan Mahmud Badaruddin II', 'city-plm', CURRENT_TIMESTAMP),
  ('airport-pnk', 'PNK', 'Supadio', 'city-pnk', CURRENT_TIMESTAMP),
  ('airport-bdo', 'BDO', 'Husein Sastranegara', 'city-bdo', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Aircraft" ("id", "registration", "airlineCode", "type", "capacityKg", "updatedAt") VALUES
  ('aircraft-pk-sha', 'PK-SHA', 'GA', 'Boeing 737-800F', 18500, CURRENT_TIMESTAMP),
  ('aircraft-pk-shb', 'PK-SHB', 'JT', 'Boeing 737-900ER', 17200, CURRENT_TIMESTAMP),
  ('aircraft-pk-shc', 'PK-SHC', 'ID', 'Airbus A320 Cargo', 16000, CURRENT_TIMESTAMP),
  ('aircraft-pk-shd', 'PK-SHD', 'QG', 'Airbus A320neo', 15800, CURRENT_TIMESTAMP),
  ('aircraft-pk-she', 'PK-SHE', 'SJ', 'Boeing 737-500', 12400, CURRENT_TIMESTAMP),
  ('aircraft-pk-shf', 'PK-SHF', 'IU', 'Boeing 737-800', 17000, CURRENT_TIMESTAMP),
  ('aircraft-pk-shg', 'PK-SHG', 'IN', 'ATR 72 Cargo', 7500, CURRENT_TIMESTAMP),
  ('aircraft-pk-shh', 'PK-SHH', 'TR', 'Boeing 737 MAX 8', 18000, CURRENT_TIMESTAMP),
  ('aircraft-pk-shi', 'PK-SHI', '8B', 'Airbus A321P2F', 27000, CURRENT_TIMESTAMP),
  ('aircraft-pk-shj', 'PK-SHJ', 'IP', 'Boeing 737-400F', 19000, CURRENT_TIMESTAMP)
ON CONFLICT ("registration") DO NOTHING;

INSERT INTO "Commodity" ("id", "code", "name", "category", "updatedAt") VALUES
  ('commodity-01', 'CMD-01', 'Elektronik Konsumer', 'High Value', CURRENT_TIMESTAMP),
  ('commodity-02', 'CMD-02', 'Produk Farmasi', 'Temperature Control', CURRENT_TIMESTAMP),
  ('commodity-03', 'CMD-03', 'Seafood Chilled', 'Temperature Control', CURRENT_TIMESTAMP),
  ('commodity-04', 'CMD-04', 'Komponen Telekomunikasi', 'High Value', CURRENT_TIMESTAMP),
  ('commodity-05', 'CMD-05', 'Suku Cadang Mesin', 'General Cargo', CURRENT_TIMESTAMP),
  ('commodity-06', 'CMD-06', 'Dokumen Ekspor', 'Document', CURRENT_TIMESTAMP),
  ('commodity-07', 'CMD-07', 'Aksesori Fashion', 'General Cargo', CURRENT_TIMESTAMP),
  ('commodity-08', 'CMD-08', 'Printed Material', 'Document', CURRENT_TIMESTAMP),
  ('commodity-09', 'CMD-09', 'Medical Devices', 'High Value', CURRENT_TIMESTAMP),
  ('commodity-10', 'CMD-10', 'Chemical Samples', 'Dangerous Goods', CURRENT_TIMESTAMP),
  ('commodity-11', 'CMD-11', 'Komoditas Pangan', 'General Cargo', CURRENT_TIMESTAMP),
  ('commodity-12', 'CMD-12', 'Retail Display Kit', 'General Cargo', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "CargoItem" ("id", "sku", "name", "commodityId", "unit", "updatedAt") VALUES
  ('item-001', 'ITEM-001', 'Smartphone Retail Pack', 'commodity-01', 'box', CURRENT_TIMESTAMP),
  ('item-002', 'ITEM-002', 'Vaksin Klinik', 'commodity-02', 'box', CURRENT_TIMESTAMP),
  ('item-003', 'ITEM-003', 'Lobster Chilled Box', 'commodity-03', 'box', CURRENT_TIMESTAMP),
  ('item-004', 'ITEM-004', 'Router BTS', 'commodity-04', 'pcs', CURRENT_TIMESTAMP),
  ('item-005', 'ITEM-005', 'Bearing Mesin', 'commodity-05', 'pcs', CURRENT_TIMESTAMP),
  ('item-006', 'ITEM-006', 'Dokumen Tender', 'commodity-06', 'pack', CURRENT_TIMESTAMP),
  ('item-007', 'ITEM-007', 'Tas Fashion', 'commodity-07', 'pcs', CURRENT_TIMESTAMP),
  ('item-008', 'ITEM-008', 'Brosur Promosi', 'commodity-08', 'pack', CURRENT_TIMESTAMP),
  ('item-009', 'ITEM-009', 'Monitor Pasien', 'commodity-09', 'pcs', CURRENT_TIMESTAMP),
  ('item-010', 'ITEM-010', 'Sample Laboratorium', 'commodity-10', 'tube', CURRENT_TIMESTAMP),
  ('item-011', 'ITEM-011', 'Kopi Kemasan', 'commodity-11', 'box', CURRENT_TIMESTAMP),
  ('item-012', 'ITEM-012', 'Display Acrylic', 'commodity-12', 'pcs', CURRENT_TIMESTAMP)
ON CONFLICT ("sku") DO NOTHING;

INSERT INTO "Tariff" ("id", "code", "originAirportId", "destinationAirportId", "serviceType", "pricePerKg", "minimumCharge", "updatedAt") VALUES
  ('tariff-soq-cgk', 'TRF-SOQ-CGK', 'airport-soq', 'airport-cgk', 'Regular', 18000, 250000, CURRENT_TIMESTAMP),
  ('tariff-soq-sub', 'TRF-SOQ-SUB', 'airport-soq', 'airport-sub', 'Priority', 19250, 265000, CURRENT_TIMESTAMP),
  ('tariff-soq-dps', 'TRF-SOQ-DPS', 'airport-soq', 'airport-dps', 'Regular', 20500, 280000, CURRENT_TIMESTAMP),
  ('tariff-soq-upg', 'TRF-SOQ-UPG', 'airport-soq', 'airport-upg', 'Priority', 21750, 295000, CURRENT_TIMESTAMP),
  ('tariff-soq-bpn', 'TRF-SOQ-BPN', 'airport-soq', 'airport-bpn', 'Regular', 23000, 310000, CURRENT_TIMESTAMP),
  ('tariff-soq-kno', 'TRF-SOQ-KNO', 'airport-soq', 'airport-kno', 'Priority', 24250, 325000, CURRENT_TIMESTAMP),
  ('tariff-soq-plm', 'TRF-SOQ-PLM', 'airport-soq', 'airport-plm', 'Regular', 25500, 340000, CURRENT_TIMESTAMP),
  ('tariff-soq-pnk', 'TRF-SOQ-PNK', 'airport-soq', 'airport-pnk', 'Priority', 26750, 355000, CURRENT_TIMESTAMP),
  ('tariff-soq-bdo', 'TRF-SOQ-BDO', 'airport-soq', 'airport-bdo', 'Regular', 28000, 370000, CURRENT_TIMESTAMP),
  ('tariff-cgk-soq', 'TRF-CGK-SOQ', 'airport-cgk', 'airport-soq', 'Priority', 29250, 385000, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "Flight"
SET
  "aircraftId" = COALESCE("aircraftId", 'aircraft-pk-sha'),
  "originAirportId" = COALESCE("originAirportId", origin_airport.id),
  "destinationAirportId" = COALESCE("destinationAirportId", destination_airport.id)
FROM "Airport" origin_airport, "Airport" destination_airport
WHERE origin_airport.code = "Flight"."origin"
  AND destination_airport.code = "Flight"."destination";

UPDATE "Shipment"
SET
  "commodityId" = COALESCE("commodityId", (SELECT id FROM "Commodity" WHERE name = "Shipment"."commodity" LIMIT 1)),
  "originAirportId" = COALESCE("originAirportId", (SELECT id FROM "Airport" WHERE code = "Shipment"."origin" LIMIT 1)),
  "destinationAirportId" = COALESCE("destinationAirportId", (SELECT id FROM "Airport" WHERE code = "Shipment"."destination" LIMIT 1)),
  "tariffId" = COALESCE(
    "tariffId",
    (
      SELECT tariff.id
      FROM "Tariff" tariff
      JOIN "Airport" origin_airport ON origin_airport.id = tariff."originAirportId"
      JOIN "Airport" destination_airport ON destination_airport.id = tariff."destinationAirportId"
      WHERE origin_airport.code = "Shipment"."origin"
        AND destination_airport.code = "Shipment"."destination"
      LIMIT 1
    )
  );

INSERT INTO "ShipmentDetail" ("id", "shipmentId", "serviceLevel", "packagingType", "insuranceValue", "declaredValue", "updatedAt")
SELECT
  'detail-' || shipment.id,
  shipment.id,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY shipment."receivedAt", shipment.id) % 2 = 0 THEN 'Regular' ELSE 'Priority' END,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY shipment."receivedAt", shipment.id) % 3 = 0 THEN 'Thermal Box' ELSE 'Carton' END,
  500000 + (ROW_NUMBER() OVER (ORDER BY shipment."receivedAt", shipment.id)::integer * 7500),
  1000000 + (ROW_NUMBER() OVER (ORDER BY shipment."receivedAt", shipment.id)::integer * 12500),
  CURRENT_TIMESTAMP
FROM "Shipment" shipment
LEFT JOIN "ShipmentDetail" detail ON detail."shipmentId" = shipment.id
WHERE detail.id IS NULL
ON CONFLICT ("shipmentId") DO NOTHING;

INSERT INTO "ShipmentItem" ("shipmentId", "cargoItemId", "quantity", "declaredValue")
SELECT shipment.id, item.id, 1, 250000
FROM "Shipment" shipment
CROSS JOIN "CargoItem" item
WHERE item.sku IN ('ITEM-001', 'ITEM-002')
ON CONFLICT ("shipmentId", "cargoItemId") DO NOTHING;
