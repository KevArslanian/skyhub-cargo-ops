"use client";

import type { ReactNode } from "react";
import Image from "next/image";

type PrintChipTone = "success" | "info" | "warning" | "danger" | "neutral";

type PrintSummaryChip = {
  label: string;
  tone?: PrintChipTone;
};

type PrintCenterLayoutProps = {
  scriptId: string;
  documentTitle: string;
  documentSubtitle: string;
  printedAtLabel: string;
  filterSummary?: string;
  summaryTitle: string;
  summarySubtitle: string;
  summaryChips: PrintSummaryChip[];
  documentCode: string;
  brandMarkSrc?: string;
  children: ReactNode;
};

const PRINT_CENTER_STYLES = `
  .print-page-bg {
    min-height: 100vh;
    background: #f1f5f9;
    padding: 24px 16px;
    color: #0b1d33;
    font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
  }

  .print-shell-wrap {
    margin: 0 auto;
    max-width: 1120px;
  }

  .print-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 0 6px;
  }

  .print-toolbar-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #0b1d33;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .print-toolbar-brand img {
    height: 38px;
    width: 38px;
    border-radius: 12px;
    border: 1px solid #bfdbfe;
    background: #ffffff;
    padding: 6px;
    object-fit: contain;
  }

  .print-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .print-toolbar-button {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 999px;
    padding: 10px 18px;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #1e293b;
    cursor: pointer;
  }

  .print-toolbar-button-primary {
    border-color: #1d4ed8;
    background: #1d4ed8;
    color: #ffffff;
  }

  .print-card {
    overflow: hidden;
    border: 1px solid #cbd5e1;
    border-radius: 24px;
    box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12);
    background: #ffffff;
  }

  .print-header {
    padding: 28px 34px;
    color: #ffffff;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  }

  .print-header-kicker {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #bae6fd;
  }

  .print-header-title {
    margin-top: 8px;
    font-size: 2rem;
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .print-header-subtitle {
    margin-top: 6px;
    color: #bfdbfe;
    font-size: 1rem;
  }

  .print-header-printed {
    margin-top: 12px;
    color: #e2e8f0;
    font-size: 0.88rem;
  }

  .print-header-meta {
    margin-top: 6px;
    font-size: 0.72rem;
    color: #7dd3fc;
  }

  .print-summary {
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
    padding: 18px 34px 16px;
  }

  .print-summary-title {
    font-size: 1rem;
    font-weight: 800;
    color: #0f172a;
  }

  .print-summary-subtitle {
    margin-top: 4px;
    font-size: 0.82rem;
    color: #475569;
  }

  .print-summary-chip-row {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .print-chip {
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 0.72rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    border: 1px solid transparent;
  }

  .print-chip-neutral {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #334155;
  }

  .print-chip-success {
    border-color: #86efac;
    background: #dcfce7;
    color: #166534;
  }

  .print-chip-info {
    border-color: #93c5fd;
    background: #dbeafe;
    color: #1d4ed8;
  }

  .print-chip-warning {
    border-color: #fcd34d;
    background: #fef3c7;
    color: #92400e;
  }

  .print-chip-danger {
    border-color: #fca5a5;
    background: #fee2e2;
    color: #991b1b;
  }

  .print-table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 620px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .print-table {
    width: 100%;
    min-width: 940px;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.84rem;
  }

  .print-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: left;
    padding: 12px 14px;
    background: linear-gradient(90deg, #0f172a, #1e293b);
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.67rem;
    font-weight: 800;
    border-bottom: 1px solid #0f172a;
  }

  .print-table td {
    border-bottom: 1px solid #e2e8f0;
    padding: 10px 14px;
    vertical-align: top;
    color: #334155;
  }

  .print-table tbody tr:nth-child(odd) {
    background: #ffffff;
  }

  .print-table tbody tr:nth-child(even) {
    background: #f8fafc;
  }

  .print-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 4px 10px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1;
  }

  .print-badge-neutral {
    border-color: #cbd5e1;
    background: #f8fafc;
    color: #334155;
  }

  .print-badge-success {
    border-color: #86efac;
    background: #dcfce7;
    color: #166534;
  }

  .print-badge-info {
    border-color: #93c5fd;
    background: #dbeafe;
    color: #1d4ed8;
  }

  .print-badge-warning {
    border-color: #fcd34d;
    background: #fef3c7;
    color: #92400e;
  }

  .print-badge-danger {
    border-color: #fca5a5;
    background: #fee2e2;
    color: #991b1b;
  }

  .print-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    font-size: 0.72rem;
    padding: 12px 34px;
  }

  @media (max-width: 640px) {
    .print-toolbar {
      flex-wrap: wrap;
      gap: 10px;
    }

    .print-toolbar-brand {
      font-size: 0.92rem;
      white-space: nowrap;
    }

    .print-table th {
      white-space: nowrap;
      font-size: 0.58rem;
      letter-spacing: 0.06em;
      padding: 10px 10px;
    }

    .print-table-wrap {
      max-height: none;
    }
  }

  @media print {
    body {
      background: #ffffff !important;
      color: #0b1d33 !important;
    }

    .print-no-print {
      display: none !important;
    }

    .print-page-bg {
      background: #ffffff !important;
      padding: 0 !important;
    }

    .print-shell-wrap {
      max-width: none !important;
      margin: 0 !important;
    }

    .print-card {
      box-shadow: none !important;
      border-radius: 0 !important;
      border-color: #cbd5e1 !important;
    }

    .print-table-wrap {
      max-height: none !important;
      overflow: visible !important;
    }

    .print-table {
      min-width: 0 !important;
    }

    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-footer-group;
    }

    tr,
    th,
    td {
      page-break-inside: avoid;
    }
  }
`;

export function PrintCenterLayout({
  scriptId,
  documentTitle,
  documentSubtitle,
  printedAtLabel,
  filterSummary,
  summaryTitle,
  summarySubtitle,
  summaryChips,
  documentCode,
  brandMarkSrc = "/skyhub-mark-blue.svg",
  children,
}: PrintCenterLayoutProps) {
  const printButtonId = `${scriptId}-print-button`;
  const backButtonId = `${scriptId}-back-button`;

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="print-page-bg">
      <style>{PRINT_CENTER_STYLES}</style>
      <div className="print-shell-wrap">
        <div className="print-toolbar print-no-print">
          <div className="print-toolbar-brand">
            <Image src={brandMarkSrc} alt="SkyHub" width={38} height={38} />
            <span>PUSAT CETAK SKYHUB</span>
          </div>
          <div className="print-toolbar-actions">
            <button id={backButtonId} type="button" className="print-toolbar-button" onClick={handleBack}>
              KEMBALI
            </button>
            <button id={printButtonId} type="button" className="print-toolbar-button print-toolbar-button-primary" onClick={() => window.print()}>
              CETAK
            </button>
          </div>
        </div>
        <article className="print-card">
          <header className="print-header">
            <p className="print-header-kicker">Pusat Cetak SkyHub</p>
            <h1 className="print-header-title">{documentTitle}</h1>
            <p className="print-header-subtitle">{documentSubtitle}</p>
            <p className="print-header-printed">Dicetak pada {printedAtLabel}</p>
            <p className="print-header-meta">{filterSummary || "Tanpa filter tambahan"}</p>
          </header>
          <section className="print-summary">
            <h2 className="print-summary-title">{summaryTitle}</h2>
            <p className="print-summary-subtitle">{summarySubtitle}</p>
            <div className="print-summary-chip-row">
              {summaryChips.map((chip, index) => (
                <span key={`${chip.label}-${index}`} className={`print-chip print-chip-${chip.tone || "neutral"}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </section>
          {children}
          <footer className="print-footer">
            <span>Pusat Cetak SkyHub • Penggunaan Internal</span>
            <span>{documentCode}</span>
          </footer>
        </article>
      </div>
    </div>
  );
}
