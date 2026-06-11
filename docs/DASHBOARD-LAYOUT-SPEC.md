# Dashboard Pusat Kendali — Layout Spec

**Route:** `/dashboard/control-center/summary`  
**Constraint:** zero page scroll (lihat `docs/OPERATOR-UX-PATTERN.md`)

## Zona wajib (satu viewport desktop ≥1024px)

```
+------------------------------------------------------------------+
| KPI | KPI | KPI | KPI                                              |
+-----+-------------+------------------------+-----------------------+
| Alur| Pendapatan  |                        | Peringatan (max 4)    |
| 3bar| chart       |                        |                       |
+-----+-------------+------------------------+-----------------------+
| Jadwal pesawat (tabel, 7 col)            | Status pesawat (5 col)  |
+--------------------------------------------+-------------------------+
  baris tengah: 3 | 5 | 4          baris bawah: 7 | 5
```

## Grid

| Breakpoint | KPI | Body grid |
|------------|-----|-----------|
| <1024px | 1–2 col stack | 1 col stack |
| ≥1024px | 4 col | 12 col: 3 \| 5 \| 4 |

## Proporsi vertikal (≥1024px)

- KPI strip: ~72px, `shrink-0`
- Body: `flex-1 min-h-0`
- Center stack: `grid-template-rows: 2fr 3fr` (revenue / jadwal)
- Right stack: `grid-template-rows: 11fr 9fr` (peringatan / status pesawat)

## Format panel

- **Kolom kiri (Alur):** `ShipmentFlowTower` — focus count + lane grid 2×3 + pipeline bar; mengisi tinggi panel penuh.
- **Jadwal tengah bawah:** daftar vertikal padat (`FlightScheduleStrip` stack mode); **dilarang** `overflow-x` / scroll horizontal.

## Dilarang

- Page scroll pada `.ops-locked-page` / `.app-main-scroll`
- Scroll horizontal pada jadwal penerbangan di summary
- Glass/blur di panel operator
- Ganti palette corporate biru Kelas C
- Hapus salah satu zona wajib: KPI, alur, revenue, jadwal, peringatan, status pesawat

## Referensi eksternal (mood, bukan copy tema)

- [Linear dashboards](https://linear.app/now/dashboards-best-practices) — exception panel
- [Cargo TMS Behance](https://www.behance.net/gallery/199111429/Cargo-TMS-System-SaaS-UI-UX-Design) — exception-first
- [Datadog TV mode](https://docs.datadoghq.com/dashboards/guide/tv_mode/) — single viewport

## Verifikasi

```bash
PORT=3100 pnpm dev
node scripts/qa-viewport-lock.mjs --route /dashboard/control-center/summary
```

Screenshot: `test-results/viewport-lock/dashboard-control-center-summary-desktop.png`