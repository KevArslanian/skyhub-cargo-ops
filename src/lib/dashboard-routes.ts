/**
 * Rute eksplisit Pusat Kendali — navigasi pakai Link; aksi in-page pakai button + onClick.
 */

export const DASHBOARD_ROUTES = {
  /** Redirect default dari /dashboard */
  home: "/dashboard/control-center/summary",

  /** Ringkasan operasional (satu-satunya view Pusat Kendali) */
  summary: "/dashboard/control-center/summary",

  /** Lonceng / daftar pemberitahuan penuh */
  notifications: "/dashboard/notifications",

  /** Jadwal pesawat dari panel kanan */
  flights: {
    list: "/dashboard/control-center/flights",
    detail: (flightId: string) => `/dashboard/control-center/flights/${flightId}`,
    edit: (flightId: string) => `/dashboard/control-center/flights/${flightId}/edit`,
  },

  kpi: {
    activeShipments: "/shipment-ledger",
    actionRequired: "/shipment-ledger",
    openAlerts: "/alerts?workflow=open",
    partialDocs: "/shipment-ledger?status=review",
    holds: "/shipment-ledger?status=hold",
  },

  alerts: {
    center: "/alerts?workflow=open",
    critical: "/alerts?severity=critical",
    warning: "/alerts?severity=warning",
  },

  activityLog: "/activity-log",
  shipmentLedger: "/shipment-ledger",
} as const;

export function isDashboardControlCenterPath(pathname: string) {
  return pathname.startsWith("/dashboard/control-center");
}