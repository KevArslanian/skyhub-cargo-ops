import { getFlightVisualMeta, type SupportedAirlineCode } from "./flight-meta";

export const FLIGHT_MASTER_RULES = {
  cargoCutoffMinutesBeforeDeparture: 70,
  fallbackDurationMinutes: 90,
} as const;

const ROUTE_DURATION_MINUTES: Record<string, number> = {
  "SOQ-CGK": 140,
  "SOQ-SUB": 80,
  "SOQ-DPS": 150,
  "SOQ-UPG": 100,
  "SOQ-BPN": 70,
  "CGK-SOQ": 140,
  "SUB-SOQ": 80,
  "DPS-SOQ": 150,
  "UPG-SOQ": 100,
  "BPN-SOQ": 70,
  "CGK-SUB": 75,
  "CGK-DPS": 110,
  "SUB-DPS": 60,
  "BPN-UPG": 70,
};

const DESTINATION_GATE: Record<string, string> = {
  BPN: "B2",
  CGK: "C7",
  DPS: "D5",
  SOQ: "S1",
  SUB: "S3",
  UPG: "U4",
};

export function getDefaultAircraftType(airlineCode: SupportedAirlineCode) {
  return getFlightVisualMeta(`${airlineCode}-000`).aircraftType;
}

export function getRouteDurationMinutes(origin: string, destination: string) {
  return ROUTE_DURATION_MINUTES[`${origin.toUpperCase()}-${destination.toUpperCase()}`] ?? FLIGHT_MASTER_RULES.fallbackDurationMinutes;
}

export function getGateForDestination(destination: string) {
  return DESTINATION_GATE[destination.toUpperCase()] ?? `${destination.toUpperCase().slice(0, 1) || "G"}1`;
}

export function getCargoCutoffTime(departureTime: Date) {
  return new Date(departureTime.getTime() - FLIGHT_MASTER_RULES.cargoCutoffMinutesBeforeDeparture * 60_000);
}

export function getEstimatedArrivalTime(departureTime: Date, origin: string, destination: string) {
  return new Date(departureTime.getTime() + getRouteDurationMinutes(origin, destination) * 60_000);
}
