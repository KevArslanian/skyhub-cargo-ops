# 🎯 INDEX MASTER DOKUMEN AUDIT KODE & RUBRIK SIWEB (EDISI TERFRAGMENTASI & OPERASIONAL PENERBANGAN)

**Mata Kuliah:** Sistem Informasi Berbasis Web (SIWEB)  
**Kasus Penilaian:** Kelas C — Operator Bandara & Ruang Kontrol Kargo Udara  
**Dokumen Acuan Resmi bagi Asisten Dosen (Asdos)**  
**Status Audit:** COMPLETED — 100% Verified (Dengan Integrasi Teori UI/UX Imersif & Standar Kargo Udara Internasional)

Untuk mempercepat pemrosesan dan meminimalkan beban kognitif sistem, dokumen audit SIWEB yang kompleks dan super detail ini telah dipecah menjadi beberapa bagian terpisah:

---

## 🗂️ QUICK NAVIGATION & DAFTAR BERKAS AUDIT SIWEB

### 1. [Bagian 1: Struktur Rubrik & Requirement Map](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/01-rubrik-dan-requirement.md)
*   **Isi Utama:**
    *   **I. STRUKTUR RUBRIK PENILAIAN SIWEB (100%):** Pembagian bobot 40% pakem, 20% logika, 20% UI/UX, 10% teknis, 10% laporan beserta kriteria skala 0-4.
    *   **II. PEMETAAN REQUIREMENT SIWEB KELAS C → SKYHUB:** Bukti status kepatuhan dari 10 persyaratan akademik operator bandara.

### 2. [Bagian 2: Laporan Audit Utama, Responsivitas Viewport & Aksesibilitas Kontras](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/02-audit-visual-dan-kontras.md)
*   **Isi Utama:**
    *   **III. LAPORAN AUDIT UTAMA:** Ringkasan eksekutif dan blocker konsep bisnis akun pelanggan.
    *   **IV. MATRIKS RESPONSIVITAS VIEWPORT:** Identifikasi layout breaks pada mobile, tablet, dan widescreen.
    *   **V. AUDIT THEMING & AKSESIBILITAS KONTRAS:** Kegagalan WCAG AA pada badge kargo hold dan border input mode gelap.

### 3. [Bagian 3: Audit Logika Kode, Settings Deep Dive & Tata Letak Dasbor](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/03-audit-logika-dan-settings.md)
*   **Isi Utama:**
    *   **VI. AUDIT KODE & LOGIKA SECARA MENDALAM:** Temuan di settings (static bypass), complaints page buttons, shipment ledger tanggal, flight board, alerts resolution.
    *   **VII. AUDIT KHUSUS HALAMAN SETTINGS & KESIAPAN LAYOUT DASBOR:** Pengungkapan pengaturan tersembunyi (auto-refresh, alerts, zulu time), sub-KPI ramping dasbor, dan pedoman layout sistem.

### 4. [Bagian 4: Teori UI/UX Imersif & Standar Operasional Kargo Udara Internasional](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/04-teori-uiux-dan-standar-iata.md)
*   **Isi Utama:**
    *   **VIII. TEORI UI/UX SISTEM OPERASIONAL UDARA IMERSIF:** Kajian Fitts's Law, Miller's Law, Hick's Law, prinsip Gestalt (Proximity & Similarity), Aesthetic-Usability Effect, dan Shneiderman's 8 Golden Rules.
    *   **IX. STANDAR OPERASIONAL & FORMAT KARGO UDARA INTERNASIONAL:** Check digit IATA Modulo 7, Cargo iQ Milestones (FOH, RCS, DEP, ARR, AWD, DLV), dan Cargo-IMP/XML messaging (FWB, FHL, FSU).

### 5. [Bagian 5: Laporan Pengujian, Panduan Refactoring (14 Diff Blocks) & Checklist Produksi](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/05-laporan-pengujian-dan-refactoring.md)
*   **Isi Utama:**
    *   **X. LAPORAN SINKRONISASI MODUL & PENGUJIAN E2E:** E2E testing (13/13 Skenario PASS, 25/25 Access PASS).
    *   **XI. PANDUAN REFAKTORING & PERBAIKAN KODE PRESISI:** Panduan implementasi drop-in perbaikan kode untuk 14 area (Tombol & Pagination keluhan, ledger, flight board, alerts, validators Modulo 7 AWB, dasbor sub-KPI grid, settings exposure, format.ts dynamic Zulu time, dll).
    *   **XII. CHECKLIST PENYELESAIAN & KESIAPAN PRODUKSI:** Checklist uji akhir untuk logika, a11y, dan UI/UX sebelum peluncuran produksi.

---

## 📋 PANDUAN EKSEKUSI BAGI AGEN PENGEMBANG
Agen AI Anda dapat menelusuri [Bagian 5: Panduan Refactoring](file:///Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone/siweb-audit/05-laporan-pengujian-dan-refactoring.md) untuk langsung mengeksekusi git diff presisi di modul kargo SkyHub tanpa kerancuan atau ambiguitas logika.
