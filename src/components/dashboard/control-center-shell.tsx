"use client";

import type { ReactNode } from "react";
import { PageHeader, OpsFeedbackBanner } from "@/components/ops-ui";
import { OpsLockedPage } from "@/components/ops-locked-page";
import { SkeletonBlock } from "@/components/ops-ui";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";

export function ControlCenterShell({ children }: { children: ReactNode }) {
  const { kpiLoading, kpiSlow, kpiError, kpiData, viewModel, retryDashboardKpis } = useDashboardContext();

  if (!kpiLoading && !kpiData) {
    return (
      <OpsLockedPage
        className="dashboard-fixed-viewport gap-4 overflow-x-hidden"
        aria-label="Dasbor operasional gagal dimuat"
        body={
          <OpsFeedbackBanner
            tone="error"
            title="Gagal memuat dasbor"
            description={kpiError ?? "Ringkasan operasional belum bisa dimuat."}
            onRetry={retryDashboardKpis}
            retryLabel="Muat ulang"
          />
        }
      />
    );
  }

  if (kpiLoading && !kpiData) {
    return (
      <OpsLockedPage
        className="dashboard-fixed-viewport gap-4 overflow-x-hidden"
        aria-label="Memuat dasbor operasional"
        body={
          <>
            {kpiSlow ? (
              <OpsFeedbackBanner
                tone="warning"
                title="Memuat lebih lama dari biasanya"
                description="Koneksi atau basis data sedang sibuk. Anda bisa menunggu sebentar atau muat ulang."
                onRetry={retryDashboardKpis}
                retryLabel="Muat ulang"
                compact
              />
            ) : null}
            <SkeletonBlock className="h-[72px] w-full rounded-[16px]" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={`sk-kpi-${i}`} className="h-[72px] w-full rounded-[14px]" />
              ))}
            </div>
            <SkeletonBlock className="h-[320px] w-full rounded-[18px]" />
          </>
        }
      />
    );
  }

  return (
    <OpsLockedPage
      className="dashboard-viewport dashboard-fixed-viewport dashboard-operator-viewport gap-4 overflow-x-hidden"
      header={<PageHeader eyebrow="Ruang Kontrol" title="Pusat Kendali" className="sr-only" />}
      body={
        <div className="dashboard-operator-body flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <div className="dashboard-kpi-grid grid shrink-0 gap-3">
            {viewModel.kpiCards.map((card) => (
              <KpiCard key={card.id} {...card} />
            ))}
          </div>

          <div className="dashboard-tab-content min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      }
    />
  );
}