import type { FlightStatus, ShipmentStatus, UserRole } from "@prisma/client";

export const APP_NAME = "SkyHub";
export const APP_SUBTITLE = "Cargo Ops Control";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shipment-ledger", label: "Shipment Ledger" },
  { href: "/awb-tracking", label: "AWB Tracking" },
  { href: "/flight-board", label: "Flight Board" },
  { href: "/activity-log", label: "Activity Log" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

export const DEFAULT_ROUTE_BY_ROLE: Record<UserRole, string> = {
  admin: "/dashboard",
  supervisor: "/dashboard",
  operator: "/dashboard",
  customer: "/awb-tracking",
};

export function canAccessRoute(role: UserRole, pathname: string) {
  if (pathname.startsWith("/awb-tracking")) {
    return true;
  }

  if (role === "customer") {
    return false;
  }

  if (pathname.startsWith("/settings")) {
    return role === "supervisor" || role === "admin";
  }

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/shipment-ledger") ||
    pathname.startsWith("/flight-board") ||
    pathname.startsWith("/activity-log") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/exports")
  ) {
    return role === "operator" || role === "supervisor" || role === "admin";
  }

  return role === "operator" || role === "supervisor" || role === "admin";
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  received: "Received",
  sortation: "Sortation",
  loaded_to_aircraft: "Loaded to Aircraft",
  departed: "Departed",
  arrived: "Arrived",
  hold: "Hold",
};

export const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  on_time: "On-Time",
  delayed: "Delayed",
  departed: "Departed",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  customer: "Customer",
};

export const AWB_REGEX = /^\d{3}-\d{8}$/;
