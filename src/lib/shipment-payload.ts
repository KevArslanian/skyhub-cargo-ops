import { AIR_CARGO_MODE, AIR_VEHICLE_TYPE, computeShippingRate } from "./constants";

export const DEFAULT_PIECES = 1;

export const SHIPPING_RATE_TOOLTIP =
  "Tarif dihitung otomatis dari berat (kg) × tarif layanan: Economy Rp20.000, Standard Rp30.000, Express Priority Rp50.000 per kg.";

export type ShipmentFlightVehicleContext = {
  vehicleName: string;
  vehicleCode: string;
  vehicleCapacityKg: number;
  vehicleStatus: string;
} | null;

type ShipmentSubmitInput = Record<string, unknown>;

function resolveNullableId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildShipmentSubmitPayload<T extends ShipmentSubmitInput>(
  input: T,
  options?: { activeFlight?: ShipmentFlightVehicleContext },
) {
  const serviceType = String(input.serviceType ?? "Standard");
  const weightKg = Number(input.weightKg ?? 0);
  const activeFlight = options?.activeFlight ?? null;

  return {
    ...input,
    awb: typeof input.awb === "string" ? input.awb : "",
    pieces: DEFAULT_PIECES,
    cargoMode: AIR_CARGO_MODE,
    vehicleType: AIR_VEHICLE_TYPE,
    shippingRate: computeShippingRate(serviceType, weightKg),
    flightId: resolveNullableId(input.flightId),
    customerAccountId: resolveNullableId(input.customerAccountId),
    vehicleName: activeFlight?.vehicleName ?? input.vehicleName,
    vehicleCode: activeFlight?.vehicleCode ?? input.vehicleCode,
    vehicleCapacityKg: activeFlight?.vehicleCapacityKg ?? input.vehicleCapacityKg,
    vehicleStatus: activeFlight?.vehicleStatus ?? input.vehicleStatus,
  };
}