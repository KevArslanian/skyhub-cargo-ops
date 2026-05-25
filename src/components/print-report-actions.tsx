"use client";

import { ArrowLeft, X } from "lucide-react";

type PrintReportActionsProps = {
  fallbackHref?: string;
};

export function PrintReportActions({ fallbackHref = "/dashboard" }: PrintReportActionsProps) {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = fallbackHref;
  }

  function closeReport() {
    window.close();
    window.location.href = fallbackHref;
  }

  return (
    <div className="print-report-actions" aria-label="Navigasi laporan">
      <button type="button" className="print-report-action-button" onClick={goBack}>
        <ArrowLeft size={16} />
        Kembali
      </button>
      <button type="button" className="print-report-action-button print-report-close-button" onClick={closeReport} aria-label="Tutup laporan">
        <X size={16} />
      </button>
    </div>
  );
}
