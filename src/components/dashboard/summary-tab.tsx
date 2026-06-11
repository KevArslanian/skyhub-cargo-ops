"use client";

import { SERVICE_LEVEL_RATES } from "@/lib/constants";
import { buildFlightScheduleItems, formatDashboardIdr } from "@/lib/dashboard-view-model";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card";
import { ShipmentFlowCompact } from "@/components/dashboard/shipment-flow-compact";
import { RevenueAreaChart } from "@/components/dashboard/revenue-area-chart";
import { AircraftStatusPanel } from "@/components/dashboard/aircraft-status-panel";
import { FlightScheduleTable } from "@/components/dashboard/flight-schedule-table";
import { DashboardAlertsPanel } from "@/components/dashboard/dashboard-alerts-panel";
import { filterFlightsByQuery } from "@/hooks/use-dashboard-data";

const DONUT_INDIGO = "hsl(226, 70%, 50%)";
const DONUT_EMERALD = "hsl(142, 72%, 35%)";
const DONUT_SKY = "hsl(200, 80%, 55%)";
const DONUT_AMBER = "hsl(38, 92%, 50%)";

const SERVICE_RATE_SUMMARY = Object.entries(SERVICE_LEVEL_RATES)
  .map(([service, rate]) => `${service} Rp${Math.round(rate / 1000)}rb/kg`)
  .join(" · ");

/** Ringkasan — baris tengah: alur | pendapatan | peringatan; baris bawah: jadwal tabel | status */
export function SummaryTab() {
  const {
    viewModel,
    shipmentsToday,
    flightsToday,
    sortedFlights,
    dashboardQuery,
    refreshKpis,
    showAlert,
    showToast,
    alertSummary,
    alertsLoading,
  } = useDashboardContext();

  const { flow, revenue, aircraftRows, flightScheduleMetric } = viewModel;
  const scheduleItems = buildFlightScheduleItems(filterFlightsByQuery(sortedFlights, dashboardQuery));
  const revenueFooter = `Total shippingRate dari ${shipmentsToday.length} AWB · ${SERVICE_RATE_SUMMARY}`;

  return (
    <div className="dashboard-summary-layout min-h-0 flex-1 overflow-hidden">
      <div className="dashboard-summary-row dashboard-summary-row-mid min-h-0 overflow-hidden">
        <DashboardChartCard
          title="Alur Pengiriman"
          className="dashboard-summary-slot-flow h-full min-h-0"
          metric={`${flow.inFlowCount} dalam alur`}
          accent={DONUT_INDIGO}
        >
          <ShipmentFlowCompact stages={flow.stages} inFlowCount={flow.inFlowCount} totalCount={flow.totalCount} />
        </DashboardChartCard>

        <DashboardChartCard
          title="Pendapatan Harian"
          className="dashboard-summary-slot-revenue dashboard-chart-card--revenue h-full min-h-0"
          metric={revenue.totalRevenue > 0 ? formatDashboardIdr(revenue.totalRevenue) : "—"}
          metricNote={`${revenue.peakLabel} · ${revenue.totalAwb} AWB`}
          metricWide
          accent={DONUT_EMERALD}
          footerNote={
            <p className="line-clamp-1 text-[11px] text-[color:var(--muted-fg)]" title={revenueFooter}>
              {revenueFooter}
            </p>
          }
        >
          <RevenueAreaChart buckets={revenue.buckets} compact />
        </DashboardChartCard>

        <DashboardChartCard
          title="Peringatan"
          className="dashboard-summary-slot-alerts dashboard-chart-card--alerts h-full min-h-0"
          metric={alertsLoading ? "…" : String(alertSummary.open)}
          metricNote={`${alertSummary.critical} kritis · ${alertSummary.warning} perhatian`}
          accent={DONUT_AMBER}
        >
          <DashboardAlertsPanel openCount={alertSummary.open} loading={alertsLoading} />
        </DashboardChartCard>
      </div>

      <div className="dashboard-summary-row dashboard-summary-row-bottom min-h-0 overflow-hidden">
        <div className="dashboard-summary-slot-schedule h-full min-h-0">
          <FlightScheduleTable flights={scheduleItems} metric={flightScheduleMetric} />
        </div>

        <DashboardChartCard
          title="Status Pesawat"
          className="dashboard-summary-slot-status dashboard-chart-card--status h-full min-h-0"
          metric={flightScheduleMetric}
          accent={DONUT_SKY}
        >
          <AircraftStatusPanel
            aircraftStatusRows={aircraftRows}
            flights={flightsToday}
            shipments={shipmentsToday}
            onReassignComplete={refreshKpis}
            showToast={showToast}
            showAlert={showAlert}
          />
        </DashboardChartCard>
      </div>
    </div>
  );
}