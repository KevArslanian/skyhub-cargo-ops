import assert from "node:assert/strict";
import {
  computeShippingRate,
  getRouteRateMultiplier,
  getWeightTierMultiplier,
  type StationCode,
} from "../src/lib/constants";

function asStation(value: string): StationCode {
  return value as StationCode;
}

const soqCgkStandard = computeShippingRate({
  serviceType: "Standard",
  weightKg: 10,
  origin: "SOQ",
  destination: "CGK",
  aircraftType: "Boeing 737-900ER",
});

const soqDpsStandard = computeShippingRate({
  serviceType: "Standard",
  weightKg: 10,
  origin: "SOQ",
  destination: "DPS",
  aircraftType: "Boeing 737-900ER",
});

assert.notEqual(soqCgkStandard, soqDpsStandard, "destination should change shipping rate");
assert.ok(soqDpsStandard > soqCgkStandard, "SOQ-DPS should cost more than SOQ-CGK at same weight");

const lightCargo = computeShippingRate({
  serviceType: "Standard",
  weightKg: 10,
  origin: "SOQ",
  destination: "CGK",
  aircraftType: "Boeing 737-900ER",
});

const heavyCargo = computeShippingRate({
  serviceType: "Standard",
  weightKg: 200,
  origin: "SOQ",
  destination: "CGK",
  aircraftType: "Boeing 737-900ER",
});

assert.ok(heavyCargo > lightCargo, "heavier cargo should cost more in absolute terms");

const atrRate = computeShippingRate({
  serviceType: "Standard",
  weightKg: 50,
  origin: "SOQ",
  destination: "CGK",
  aircraftType: "ATR 72-600",
});

const widebodyRate = computeShippingRate({
  serviceType: "Standard",
  weightKg: 50,
  origin: "SOQ",
  destination: "CGK",
  aircraftType: "Airbus A330-300",
});

assert.ok(atrRate < widebodyRate, "smaller aircraft should be cheaper than widebody");

assert.equal(getRouteRateMultiplier("SOQ", "CGK"), 1);
assert.equal(getWeightTierMultiplier(10), 1.15);
assert.equal(getWeightTierMultiplier(80), 1);

void asStation("CGK");

console.log("shipping-rate checks passed");