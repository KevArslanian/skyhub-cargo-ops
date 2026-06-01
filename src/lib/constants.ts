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
export const APP_CANONICAL_URL = "https://skyhub-cargo-ops.vercel.app";

export function absoluteAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${APP_CANONICAL_URL}${normalizedPath}`;
}

export const STATION_OPTIONS = ["CGK", "SUB", "DPS", "SOQ", "UPG", "BPN"] as const;
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
export const SERVICE_TYPE_OPTIONS = ["Biasa", "Cepat", "VVIP"] as const;
export const VEHICLE_TYPE_OPTIONS = ["Truk Box", "Pesawat", "Kapal Cargo"] as const;
export const VEHICLE_STATUS_OPTIONS = ["Aktif", "Maintenance", "Nonaktif"] as const;
export const GOODS_STATUS_OPTIONS = [
  "Diproses",
  "Dalam Pengiriman",
  "Sampai Tujuan",
  "Pending",
  "Selesai",
] as const;
export const TRANSACTION_STATUS_OPTIONS = ["Belum_Lunas", "Menunggu_Verifikasi", "Lunas", "Tidak_Ditagih", "Pending"] as const;

export const SHIPMENT_TRANSACTION_STATUS_LABELS: Record<ShipmentTransactionStatus, string> = {
  Belum_Lunas: "Belum Lunas",
  Menunggu_Verifikasi: "Menunggu Verifikasi",
  Lunas: "Lunas",
  Tidak_Ditagih: "Tidak Ditagih",
  Pending: "Pending",
};

export const SHIPMENT_DOC_STATUS_LABELS: Record<ShipmentDocStatus, string> = {
  Complete: "Complete",
  Partial: "Partial",
  Review: "Review",
};

export const SHIPMENT_READINESS_LABELS: Record<ShipmentReadiness, string> = {
  Ready: "Ready",
  Pending: "Pending",
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

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff Operasional",
  customer: "Pelanggan",
};

export const ROLE_SCOPE_COPY: Record<UserRole, string> = {
  admin: "Kelola pengguna, akun pelanggan, dan seluruh modul operasional.",
  staff: "Kelola workflow operasional harian tanpa manajemen pengguna atau akun pelanggan.",
  customer: "Akses pelacakan AWB, cetak, dan pelaporan isu sesuai akun pelanggan.",
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
