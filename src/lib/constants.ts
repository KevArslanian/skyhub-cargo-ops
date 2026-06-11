import type {
  CustomerAccountStatus,
  FlightStatus,
  ShipmentDocStatus,
  ShipmentReadiness,
  ShipmentStatus,
  ShipmentTransactionStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";

export const APP_NAME = "SkyHub";
export const APP_SUBTITLE = "Pusat Kendali Kargo";
/** Default list pagination for operator workspace pages (viewport-locked layout). */
export const OPS_LIST_PAGE_SIZE = 6;
export const APP_CANONICAL_URL = "https://skyhub-cargo-ops.vercel.app";

export function absoluteAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${APP_CANONICAL_URL}${normalizedPath}`;
}

/** Zona waktu operasional tunggal untuk seluruh workspace (bukan preferensi per pengguna). */
export const ORG_TIME_ZONE = "Asia/Makassar";
export const ORG_TIME_ZONE_LABEL = "WITA";

export const STATION_OPTIONS = ["CGK", "SUB", "DPS", "SOQ", "UPG", "BPN"] as const;

export type StationCode = (typeof STATION_OPTIONS)[number];

/** Nama bandara lengkap untuk tampilan form dan label (nilai tetap kode IATA). */
export const STATION_LABELS: Record<StationCode, string> = {
  CGK: "Jakarta Soekarno-Hatta (CGK)",
  SUB: "Surabaya Juanda (SUB)",
  DPS: "Denpasar Ngurah Rai (DPS)",
  SOQ: "Sorong Domine Eduard Osok (SOQ)",
  UPG: "Makassar Sultan Hasanuddin (UPG)",
  BPN: "Balikpapan Sepinggan (BPN)",
};

export function formatStationLabel(code: string) {
  return STATION_LABELS[code as StationCode] ?? code;
}

/** Ringkas untuk badge dan sidebar sempit — hindari overflow nama bandara panjang. */
export function formatStationShortLabel(code: string) {
  const full = formatStationLabel(code);
  const match = full.match(/^(.+?)\s*\(([A-Z]{3})\)$/);
  if (match) {
    const city = match[1].split(" ")[0];
    return `${city} (${match[2]})`;
  }
  return code;
}

export function stationSelectOptions() {
  return STATION_OPTIONS.map((code) => ({
    value: code,
    label: formatStationLabel(code),
  }));
}
export const AIRCRAFT_TYPE_OPTIONS = [
  "Airbus A320-200",
  "Airbus A320neo",
  "Airbus A330-300",
  "ATR 72-600",
  "Boeing 737-500F",
  "Boeing 737-800F",
  "Boeing 737-900ER",
] as const;
export const CARGO_MODE_OPTIONS = ["Darat", "Udara", "Laut"] as const;
export const AIR_CARGO_MODE = "Udara" as const;
export const AIR_VEHICLE_TYPE = "Pesawat" as const;
export const SERVICE_TYPE_OPTIONS = ["Economy", "Standard", "Express Priority"] as const;

export const SERVICE_LEVEL_RATES: Record<(typeof SERVICE_TYPE_OPTIONS)[number], number> = {
  "Express Priority": 50_000,
  Standard: 30_000,
  Economy: 20_000,
};

/** Pengali tarif per rute (origin-tujuan). Asal biasanya stasiun aktif operator. */
export const ROUTE_RATE_MULTIPLIERS: Record<string, number> = {
  "SOQ-CGK": 1.0,
  "SOQ-DPS": 1.15,
  "SOQ-SUB": 0.9,
  "SOQ-UPG": 0.95,
  "SOQ-BPN": 0.85,
  "CGK-SOQ": 1.0,
  "CGK-SUB": 0.88,
  "CGK-DPS": 0.92,
  "CGK-UPG": 0.9,
  "CGK-BPN": 0.82,
  "SUB-SOQ": 0.9,
  "SUB-CGK": 0.88,
  "SUB-DPS": 0.85,
  "SUB-UPG": 0.87,
  "SUB-BPN": 0.8,
  "DPS-SOQ": 1.15,
  "DPS-CGK": 0.92,
  "DPS-SUB": 0.85,
  "DPS-UPG": 0.9,
  "DPS-BPN": 0.88,
  "UPG-SOQ": 0.95,
  "UPG-CGK": 0.9,
  "UPG-SUB": 0.87,
  "UPG-DPS": 0.9,
  "UPG-BPN": 0.83,
  "BPN-SOQ": 0.85,
  "BPN-CGK": 0.82,
  "BPN-SUB": 0.8,
  "BPN-DPS": 0.88,
  "BPN-UPG": 0.83,
};

/** Pengali tarif per tipe armada. */
export const AIRCRAFT_RATE_MULTIPLIERS: Record<string, number> = {
  "ATR 72-600": 0.85,
  "Boeing 737-500F": 0.9,
  "Boeing 737-800F": 0.95,
  "Boeing 737-900ER": 1.0,
  "Airbus A320-200": 1.02,
  "Airbus A320neo": 1.05,
  "Airbus A330-300": 1.2,
};

export const DEFAULT_PRICING_AIRCRAFT_TYPE = "Boeing 737-900ER" as const;

export function getRouteRateMultiplier(origin: string, destination: string) {
  const key = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
  return ROUTE_RATE_MULTIPLIERS[key] ?? 1;
}

export function getAircraftRateMultiplier(aircraftType?: string | null) {
  if (!aircraftType?.trim()) {
    return AIRCRAFT_RATE_MULTIPLIERS[DEFAULT_PRICING_AIRCRAFT_TYPE] ?? 1;
  }
  return AIRCRAFT_RATE_MULTIPLIERS[aircraftType] ?? 1;
}

/** Sedikit dibedakan per kelompok berat (di atas faktor linear kg). */
export function getWeightTierMultiplier(weightKg: number) {
  if (weightKg <= 25) return 1.15;
  if (weightKg <= 100) return 1;
  if (weightKg <= 500) return 0.92;
  return 0.88;
}

export type ShippingRateInput = {
  serviceType: string;
  weightKg: number;
  origin: string;
  destination: string;
  aircraftType?: string | null;
};

export function computeShippingRate(input: ShippingRateInput) {
  const serviceRate =
    SERVICE_LEVEL_RATES[input.serviceType as keyof typeof SERVICE_LEVEL_RATES] ?? SERVICE_LEVEL_RATES.Standard;
  const routeFactor = getRouteRateMultiplier(input.origin, input.destination);
  const aircraftFactor = getAircraftRateMultiplier(input.aircraftType);
  const weightTierFactor = getWeightTierMultiplier(input.weightKg);
  return Math.round(
    input.weightKg * serviceRate * routeFactor * aircraftFactor * weightTierFactor,
  );
}

export function destinationSelectOptions(origin: string) {
  const normalizedOrigin = origin.toUpperCase();
  return STATION_OPTIONS.filter((code) => code !== normalizedOrigin).map((code) => ({
    value: code,
    label: formatStationLabel(code),
  }));
}

export function defaultDestinationForOrigin(origin: string) {
  const options = destinationSelectOptions(origin);
  return options[0]?.value ?? "CGK";
}
export const VEHICLE_TYPE_OPTIONS = ["Truk Box", "Pesawat", "Kapal Cargo"] as const;
export const VEHICLE_STATUS_OPTIONS = ["Aktif", "Perawatan", "Nonaktif"] as const;
export const GOODS_STATUS_OPTIONS = [
  "Diproses",
  "Dalam Pengiriman",
  "Sampai Tujuan",
  "Menunggu",
  "Selesai",
] as const;
export const TRANSACTION_STATUS_OPTIONS = ["Belum_Lunas", "Menunggu_Verifikasi", "Lunas", "Tidak_Ditagih", "Pending"] as const;

export const SHIPMENT_TRANSACTION_STATUS_LABELS: Record<ShipmentTransactionStatus, string> = {
  Belum_Lunas: "Belum Lunas",
  Menunggu_Verifikasi: "Menunggu Verifikasi",
  Lunas: "Lunas",
  Tidak_Ditagih: "Tidak Ditagih",
  Pending: "Menunggu",
};

export const SHIPMENT_DOC_STATUS_LABELS: Record<ShipmentDocStatus, string> = {
  Complete: "Lengkap",
  Partial: "Sebagian",
  Review: "Ditinjau",
};

export const SHIPMENT_DOC_STATUS_FORM_OPTIONS = [
  { value: "Partial" as const, label: "Sebagian" },
  { value: "Complete" as const, label: "Lengkap" },
];

export function resolveShipmentDocStatusValue(labelOrValue?: string | null) {
  if (!labelOrValue) return "Partial" as const;
  if (labelOrValue === "Complete" || labelOrValue === "Lengkap") return "Complete" as const;
  return "Partial" as const;
}

export const SHIPMENT_READINESS_LABELS: Record<ShipmentReadiness, string> = {
  Ready: "Siap",
  Pending: "Menunggu",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  received: "Diterima",
  sortation: "Sortasi",
  loaded_to_aircraft: "Muat ke Pesawat",
  departed: "Berangkat",
  arrived: "Tiba",
  hold: "Tertahan",
};

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  on_time: "Terjadwal",
  delayed: "Terlambat",
  departed: "Berangkat",
};

export const DERIVED_FLIGHT_STATUS_LABELS = {
  on_time: "Terjadwal",
  at_risk: "Perlu konfirmasi",
  delayed: "Terlambat",
  departed: "Berangkat",
} as const;

export type DerivedFlightStatus = keyof typeof DERIVED_FLIGHT_STATUS_LABELS;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  staff: "Staf Operasional",
  customer: "Pelanggan",
};

export const ROLE_SCOPE_COPY: Record<UserRole, string> = {
  admin: "Kelola pengguna internal, konfigurasi ruang kerja, dan seluruh modul operasional.",
  staff: "Kelola alur kerja operasional harian tanpa manajemen pengguna.",
  customer: "Peran lama pelanggan. Login pelanggan dinonaktifkan dari workspace internal.",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Aktif",
  invited: "Diundang",
  disabled: "Nonaktif",
};

export const CUSTOMER_ACCOUNT_STATUS_LABELS: Record<CustomerAccountStatus, string> = {
  active: "Aktif",
  disabled: "Nonaktif",
};

export const AWB_REGEX = /^\d{3}-\d{8}$/;

/** Prefix AWB default untuk pelacakan publik (maskapai/kargo). */
export const PUBLIC_AWB_PREFIX = "160" as const;

/** Sentinel value when operator picks free-text commodity outside master list. */
export const COMMODITY_CUSTOM_VALUE = "__custom__";

export const FLIGHT_AUTO_SELECT_LABEL = "Pilih otomatis dari pesawat yang tersedia";
export const FLIGHT_AUTO_SELECT_SHORT_LABEL = "Otomatis";

export function formatCapacityKgLabel(kg: number) {
  const rounded = Math.max(0, Math.round(kg));
  return `${rounded.toLocaleString("id-ID")} kg`;
}

export function formatFlightSelectLabels(flight: {
  flightNumber: string;
  origin: string;
  destination: string;
  availableCapacityKg: number;
}) {
  const capacity = formatCapacityKgLabel(flight.availableCapacityKg);
  const route = `${flight.origin}-${flight.destination}`;
  return {
    label: `${flight.flightNumber} · ${route} · sisa ${capacity}`,
    shortLabel: `${flight.flightNumber} · ${route} · ${capacity}`,
  };
}

/** Cargo iQ (IATA) milestone codes for public tracking display */
export const CARGO_IQ_MILESTONES: Record<
  ShipmentStatus,
  { code: string; title: string; description: string }
> = {
  received: {
    code: "FOH",
    title: "Freight On Hand",
    description: "Kargo diterima secara fisik di gudang ekspor bandara asal.",
  },
  sortation: {
    code: "RCS",
    title: "Ready for Carriage",
    description: "Kargo dalam sortasi dan dinyatakan siap untuk diangkut.",
  },
  loaded_to_aircraft: {
    code: "RCS",
    title: "Ready for Carriage",
    description: "Kargo telah dimuat dan menunggu keberangkatan pesawat.",
  },
  departed: {
    code: "DEP",
    title: "Departure",
    description: "Pesawat berangkat menuju tujuan.",
  },
  arrived: {
    code: "ARR",
    title: "Arrival",
    description: "Kargo tiba di bandara tujuan. Tahap AWD/DLV mengikuti penyerahan ke consignee.",
  },
  hold: {
    code: "HLD",
    title: "Tertahan",
    description: "Pengiriman tertahan untuk peninjauan operasional atau dokumen.",
  },
};

export function getCargoIqMilestone(status: string) {
  return CARGO_IQ_MILESTONES[status as ShipmentStatus] ?? CARGO_IQ_MILESTONES.received;
}

/** Urutan tahap normal untuk progress bar pelacakan publik */
export const PUBLIC_TRACKING_JOURNEY: Array<{
  status: ShipmentStatus;
  shortLabel: string;
}> = [
  { status: "received", shortLabel: "Diterima" },
  { status: "sortation", shortLabel: "Sortasi" },
  { status: "loaded_to_aircraft", shortLabel: "Dimuat" },
  { status: "departed", shortLabel: "Berangkat" },
  { status: "arrived", shortLabel: "Tiba" },
];

export function getPublicTrackingJourneyIndex(status: string) {
  const index = PUBLIC_TRACKING_JOURNEY.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
}

/** Kapasitas muatan referensi per tipe armada (kg) untuk petunjuk form penerbangan */
export const AIRCRAFT_CAPACITY_KG: Record<string, number> = {
  "Boeing 737-800F": 18500,
  "Boeing 737-900ER": 17200,
  "Airbus A320 Cargo": 16000,
  "Airbus A320neo": 15800,
  "Boeing 737-500F": 12400,
  "Boeing 737-500": 12400,
  "Boeing 737-800": 17000,
  "ATR 72 Cargo": 7500,
  "ATR 72-600": 7500,
  "Airbus A330-300": 42000,
  "Airbus A320-200": 16000,
};
