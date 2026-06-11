# Skema Database SkyHub Cargo Ops

Database: **PostgreSQL** (Neon Serverless)  
ORM: **Prisma** (`prisma/schema.template.prisma` → `schema.prisma`)  
Zona waktu operasional: **Asia/Makassar**

Dokumen ini mencatat **semua tabel yang aktif** setelah audit Juni 2026. Tabel master SIWEB yang tidak dipakai runtime (City, Airport, Tariff, CargoItem, ShipmentDetail, ShipmentItem) sudah dihapus dari Neon dan schema.

---

## Ringkasan domain

| Domain | Tabel | Fungsi |
|--------|-------|--------|
| Akun | `CustomerAccount`, `User`, `UserSetting`, `UserCapabilityOverride` | Login, peran, preferensi UI, override izin |
| Operasi kargo | `Shipment`, `TrackingLog`, `ShipmentDocument`, `Flight`, `Aircraft`, `Commodity` | Manifest AWB, pelacakan, dokumen, jadwal pesawat |
| Peringatan | `AlertState`, `Notification` | Workflow peringatan operasional + lonceng |
| Publik | `PublicComplaint`, `RecentAwbSearch`, `SystemKpi` | Kotak keluhan, riwayat cari AWB, metrik landing |
| Audit | `ActivityLog` | Jejak aktivitas staf |

---

## Tabel inti

### `Shipment`
Manifest pengiriman (AWB). Satu baris = satu kiriman.

| Kolom penting | Keterangan |
|---------------|------------|
| `awb` | Nomor resi unik |
| `status` | Alur operasional: received → sortation → loaded_to_aircraft → departed → arrived / hold |
| `origin`, `destination` | Kode bandara IATA (string), contoh `SOQ`, `CGK` |
| `commodity` | Nama komoditas (string); dropdown di UI dari tabel `Commodity` |
| `docStatus` | `Partial` / `Complete` / `Review`, di-set manual operator |
| `readiness` | `Ready` / `Pending`, turunan status + dokumen + tarif |
| `transactionStatus` | Status pembayaran/tagihan |
| `shippingRate` | Tarif dalam IDR, dihitung aplikasi |
| `flightId` | Penugasan penerbangan (opsional) |
| `customerAccountId` | Akun pelanggan B2B (opsional) |
| `archivedAt` | Soft delete |

**Relasi:** `Flight`, `User` (creator), `CustomerAccount`, `TrackingLog[]`, `ShipmentDocument[]`

---

### `Flight`
Jadwal keberangkatan pesawat kargo.

| Kolom penting | Keterangan |
|---------------|------------|
| `flightNumber` | Unik, format maskapai + nomor |
| `origin`, `destination` | Kode IATA |
| `departureTime`, `arrivalTime`, `cargoCutoffTime` | Cutoff = STD − 70 menit (lihat `flight-rules.ts`) |
| `status` | `on_time` / `delayed` / `departed` (disimpan); status turunan `at_risk` dihitung di aplikasi |
| `aircraftId` | Kapasitas & registrasi pesawat |
| `archivedAt` | Arsip dari papan aktif |

**Relasi:** `Aircraft?`, `Shipment[]`

---

### `Aircraft`
Armada pesawat untuk assignment kapasitas.

| Kolom | Keterangan |
|-------|------------|
| `registration` | Unik, contoh `PK-SHA` |
| `capacityKg` | Batas muatan untuk peringatan kapasitas |
| `airlineCode`, `type` | Metadata visual & aturan maskapai |

---

### `Commodity`
Master komoditas untuk dropdown Buku Pengiriman (read-only di runtime).

| Kolom | Keterangan |
|-------|------------|
| `code` | Unik, contoh `CMD-01` |
| `name`, `category` | Label UI |

Tidak ada FK ke `Shipment`; field `Shipment.commodity` menyimpan teks yang dipilih.

---

### `TrackingLog`
Riwayat checkpoint AWB (gudang, sortasi, apron, dll.).

| Kolom | Keterangan |
|-------|------------|
| `visibility` | `customer` = tampil di pelacakan publik |
| `actorUserId` | Staf yang mencatat (opsional) |

---

### `ShipmentDocument`
Berkas terlampir pada manifest (storage Vercel Blob).

| Kolom | Keterangan |
|-------|------------|
| `deletedAt` | Soft delete + antrian cleanup blob |
| `paymentProof` | Flag bukti bayar (legacy, UI upload sudah disederhanakan) |

---

## Akun & akses

### `User`
Operator internal (`admin`, `staff`) dan akun pelanggan (`customer`, login terbatas).

### `UserSetting`
Preferensi per user: tema, refresh otomatis, timezone, warna aksen.

### `UserCapabilityOverride`
Override granular capability per user (mis. `shipment:document`).

### `CustomerAccount`
Akun B2B pelanggan; mengelompokkan user pelanggan dan manifest.

---

## Peringatan & notifikasi

### `AlertState`
State workflow peringatan operasional (open / acknowledged / snoozed / resolved).

| Field | Keterangan |
|-------|------------|
| `alertKey` | Kunci idempoten, contoh `departure-overdue-{flightId}` |
| `kind` | Jenis: `departure-overdue`, `cutoff-risk`, `shipment-hold`, dll. |
| `entityType`, `entityId` | Sumber data (flight / shipment) |

### `Notification`
Lonceng in-app per user (termasuk broadcast peringatan penerbangan).

---

## Publik & audit

### `PublicComplaint`
Tiket keluhan dari halaman About Us / pelacakan.

### `RecentAwbSearch`
Riwayat pencarian AWB per user (Pelacakan AWB).

### `SystemKpi`
Singleton `id = global` untuk uptime platform di landing page.

### `ActivityLog`
Log audit aksi staf (create/update/delete manifest, flight, dll.).

---

## Enum utama

- **ShipmentStatus:** `received`, `sortation`, `loaded_to_aircraft`, `departed`, `arrived`, `hold`
- **ShipmentDocStatus:** `Complete`, `Partial`, `Review`
- **FlightStatus (stored):** `on_time`, `delayed`, `departed`
- **AlertWorkflowStatus:** `open`, `acknowledged`, `snoozed`, `resolved`
- **ComplaintStatus / ComplaintTopic:** workflow kotak keluhan

---

## Migrasi & seed

```bash
pnpm db:migrate          # deploy ke Neon (CI: .github/workflows/neon-migrate.yml)
pnpm db:seed             # data demo operasional
pnpm prisma:sync-schema  # setelah edit schema.template.prisma
```

Migrasi penghapusan tabel orphan: `20260611120000_drop_orphan_master_tables`

---

## Tabel yang dihapus (tidak dipakai runtime)

| Tabel | Alasan penghapusan |
|-------|-------------------|
| `City`, `Airport` | Hanya seed; app memakai string IATA di Flight/Shipment |
| `Tariff` | Hanya seed; tarif dihitung `computeShippingRate` di kode |
| `CargoItem`, `ShipmentItem` | Line item tidak dipakai UI/API |
| `ShipmentDetail` | Detail asuransi/kemasan tidak dipakai create/update |

Rute bandara tetap valid lewat kode IATA di kolom `origin` / `destination`.