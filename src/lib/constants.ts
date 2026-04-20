import type { CustomerAccountStatus, FlightStatus, ShipmentStatus, UserRole, UserStatus } from "@prisma/client";

export const APP_NAME = "SkyHub";
export const APP_SUBTITLE = "Pusat Kendali Kargo";

export const STATION_OPTIONS = ["CGK", "SUB", "DPS", "SOQ", "UPG", "BPN"] as const;

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  received: "Diterima",
  sortation: "Sortasi",
  loaded_to_aircraft: "Muat ke Pesawat",
  departed: "Berangkat",
  arrived: "Tiba",
  hold: "Tertahan",
};

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  on_time: "Tepat Waktu",
  delayed: "Terlambat",
  departed: "Berangkat",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff Operasional",
  customer: "Pelanggan",
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
