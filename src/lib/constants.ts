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

export function computeShippingRate(serviceType: string, weightKg: number) {
  const rate =
    SERVICE_LEVEL_RATES[serviceType as keyof typeof SERVICE_LEVEL_RATES] ?? SERVICE_LEVEL_RATES.Standard;
  return Math.round(weightKg * rate);
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
