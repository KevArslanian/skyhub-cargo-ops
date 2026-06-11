# Pemetaan Requirement SIWEB Kelas C → SkyHub

Kelas: **C — Operator Bandara**  
Landing page: **`/about-us` tetap aktif** sebagai portal publik resmi (cek resi + pintu masuk operator).

## Checklist Kelas C

| No | Requirement | Route / File | Bukti |
|----|-------------|--------------|-------|
| 1 | Tracking AWB berjalan | `/about-us#tracking`, `/awb-tracking`, `src/app/api/awb/` | Input AWB, output status + linimasa, `@crud` PASS |
| 2 | Status + timestamp tampil | `awb-tracking/page.tsx`, `TrackingLog` model | `StatusBadge`, `formatDateTime`, "Diperbarui …" |
| 3 | Dashboard operator | `/dashboard` | KPI, manifest ringkas, peringatan, auto-refresh |
| 4 | Sidebar konsisten | `app-shell.tsx`, `access.ts` | Grup nav + hamburger mobile `Menu` |
| 5 | UI corporate clean | `(app)/*`, `globals.css` | Panel formal; landing = portal resmi (bukan marketing generik) |
| 6 | Font readable | `globals.css`, `--font-body` | Inter + heading, kontras light/dark |
| 7 | Error handling jelas | `error.tsx`, `(app)/error.tsx`, `ops-feedback.ts` | Dialog, empty state, pesan ID |
| 8 | Database sesuai | `prisma/schema.prisma` | PostgreSQL/Neon, enum status operasional |
| 9 | Relasi data | Schema FK + `src/lib/data.ts` | Shipment→Flight, TrackingLog→Shipment, User→Settings |
| 10 | Tampilan stabil | `output/visual-qa/20260608-143829` | 994/994 PASS |

## Arsitektur Dua Zona (landing + operator)

| Zona | URL | Peran |
|------|-----|-------|
| Portal publik | `/about-us` | Cek resi AWB, profil perusahaan, keluhan publik |
| Autentikasi | `/login` | Masuk staf/admin/customer |
| Ruang operator | `/dashboard`, `/shipment-ledger`, … | Kendali operasional bandara |

Landing page **bukan halaman terpisah dari requirement**, melainkan implementasi **pelacakan AWB publik** (checklist #1) sekaligus branding resmi bandara.

## Fitur Tambahan (di luar minimum)

| Fitur | Lokasi | Relevansi kasus |
|-------|--------|-----------------|
| Pusat peringatan + workflow | `/alerts` | Eskalasi operasional bandara |
| Laporan cetak operasional | `/exports/*` | Manifest siap audit |
| Kotak keluhan publik | `/complaints` + form di about-us | Layanan bandara |
| Role customer terbatas | `access.ts` | Pelanggan hanya AWB |
| Visual QA otomatis | `scripts/visual-qa.mjs` | Stabilitas tampilan terbukti |

## Verifikasi

```bash
APP_BASE_URL=http://localhost:3100 pnpm test:api
APP_BASE_URL=http://localhost:3100 pnpm qa:crud
APP_BASE_URL=http://localhost:3100 pnpm test:e2e
```