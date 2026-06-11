import type { LucideIcon } from "lucide-react";

export type DashboardKpiTone = "primary" | "success" | "warning" | "danger" | "info";

export type KpiCardItem = {
  id: string;
  href: string;
  label: string;
  value: string | number;
  note?: string;
  icon: LucideIcon;
  tone: DashboardKpiTone;
};

export type ShipmentFlowStage = {
  id: string;
  label: string;
  shortLabel: string;
  hint: string;
  count: number;
  percent: number;
};

export type RevenueBucket = {
  id: string;
  label: string;
  value: number;
  awbCount: number;
  avgPerAwb: number;
};

export type RevenueSummary = {
  buckets: RevenueBucket[];
  totalRevenue: number;
  totalAwb: number;
  peakLabel: string;
  peakBucketId: string | null;
};

export type AircraftStatusRow = {
  id: string;
  label: string;
  count: number;
  tone: "neutral" | "warning" | "danger" | "success" | "info";
};

export type FlightScheduleItem = {
  id: string;
  flightNumber: string;
  route: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  departureTime: string;
  cargoCutoffTime: string;
  cutoffAtRisk: boolean;
  needsAction: boolean;
  /** Rute unik: detail vs edit */
  openHref: string;
  manageHref: string;
};

export type DashboardFlightSummary = {
  id: string;
  flightNumber: string;
  route: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  departureTime: string;
  cargoCutoffTime: string;
  cutoffAtRisk: boolean;
  airlineName: string;
  airlineLogoUrl: string;
  aircraftType: string;
  registration: string;
  imageUrl: string;
};

export type BaseShipment = {
  id: string;
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  shippingRate: number;
  status: string;
  statusLabel: string;
  flightNumber: string | null;
  receivedAt: string;
  updatedAt: string;
  docStatus: string;
  needsReview: boolean;
  documentSummary: {
    docStatus: string;
    count: number;
    latestUploadedAt: string | null;
  };
};