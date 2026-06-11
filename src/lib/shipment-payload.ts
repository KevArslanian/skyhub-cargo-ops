import { AIR_CARGO_MODE, AIR_VEHICLE_TYPE, computeShippingRate } from "./constants";

export const DEFAULT_PIECES = 1;

export const SHIPPING_RATE_TOOLTIP =
  "Tarif otomatis: berat (kg) × tarif layanan × faktor rute tujuan × faktor tipe pesawat × kelompok berat. Economy Rp20rb/kg, Standard Rp30rb/kg, Express Priority Rp50rb/kg (sebelum pengali).";

export type ShipmentFlightVehicleContext = {
  vehicleName: string;
  vehicleCode: string;
  vehicleCapacityKg: number;
  vehicleStatus: string;
  aircraftType?: string | null;
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
  const origin = String(input.origin ?? "");
  const destination = String(input.destination ?? "");
  const activeFlight = options?.activeFlight ?? null;
  const aircraftType =
    (typeof input.aircraftType === "string" ? input.aircraftType : null) ??
    activeFlight?.aircraftType ??
    null;

  return {
    ...input,
    awb: typeof input.awb === "string" ? input.awb : "",
    pieces: DEFAULT_PIECES,
    cargoMode: AIR_CARGO_MODE,
    vehicleType: AIR_VEHICLE_TYPE,
    shippingRate: computeShippingRate({
      serviceType,
      weightKg,
      origin,
      destination,
      aircraftType,
    }),
    flightId: resolveNullableId(input.flightId),
    customerAccountId: resolveNullableId(input.customerAccountId),
    vehicleName: activeFlight?.vehicleName ?? input.vehicleName,
    vehicleCode: activeFlight?.vehicleCode ?? input.vehicleCode,
    vehicleCapacityKg: activeFlight?.vehicleCapacityKg ?? input.vehicleCapacityKg,
    vehicleStatus: activeFlight?.vehicleStatus ?? input.vehicleStatus,
  };
}