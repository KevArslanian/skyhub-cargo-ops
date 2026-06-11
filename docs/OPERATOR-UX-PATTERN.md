# Operator UX Pattern

Pola layout dan umpan balik untuk halaman CRUD operator SkyHub Ops.

## Zero-scroll + drawer popup

Halaman operator **tidak boleh scroll** (`html`, `.app-main-scroll`, `.ops-locked-page`).

| Aksi | Pola |
|------|------|
| List / tabel | Ukuran halaman dinamis via `useVisibleTablePageSize` / `useVisiblePanelPageSize` / `useVisibleStripPageSize` + `PaginationBar` |
| Klik baris | `OpsDrawer` atau `OpsDetailDrawer` (detail, boleh scroll internal) |
| Buat / Ubah | `OpsDrawer` form (boleh scroll internal) |
| Dilarang | Split-pane kanan permanen, accordion expand di halaman, `.page-scroll` vertikal di viewport |

Acuan: `flight-board/page.tsx`, `alerts/page.tsx`, `shipment-ledger/page.tsx`, `settings/page.tsx`, `awb-search-history-panel.tsx`.

### Densitas adaptif (viewport)

- Inti: `src/lib/viewport-density.ts` (ukur baris/kartu yang muat + `visualViewport` resize).
- Tabel server-paginated: `useVisibleTablePageSize` + refetch saat `pageSize` berubah (`flight-board`, `shipment-ledger`, `settings` Tim & Akses).
- Panel vertikal (kartu/list): `useVisiblePanelPageSize` + selector item (`dashboard` tabs, riwayat AWB).
- Strip horizontal: `useVisibleStripPageSize` (`flight-schedule-strip`).
- Panel flex: `height: 100%`, `min-height: 0`, hapus cap `max-height` di `vh` agar area tidak kosong saat zoom out.

```
CrudPageScaffold (viewport terkunci)
  ├── PageHeader + actions (Buat, Cetak, Riwayat, …)
  ├── FilterBar
  ├── body: tabel/list (isi panel mengikuti tinggi/lebar viewport)
  ├── PaginationBar
  └── OpsDrawer (detail / form — satu-satunya scroll vertikal)
```

## Validasi form (inline only)

- Form create/edit memakai `noValidate` + state `formErrors` per field.
- Pesan error ditampilkan di bawah field via `.form-field-error` dan border `.is-invalid`.
- Scroll ke field pertama yang gagal: `scrollToFirstFieldError()`.
- **Jangan** memakai `showAlert` / `alertdialog` untuk validasi field.

Referensi:
- Buku Pengiriman: `src/app/(app)/shipment-ledger/page.tsx`
- Manajemen Pesawat: `src/app/(app)/flight-board/page.tsx` + `validateFlightFormDetailed()` di `src/lib/client-validation.ts`

## Sukses = toast

- Operasi berhasil (create/update/delete/upload) memakai `showToast()` dari `useOpsAlert()`.
- Toast non-blocking, auto-dismiss ~4 detik, komponen `OpsToast`.
- **Jangan** memakai modal sukses untuk aksi CRUD rutin.

## Error server di atas tabel (non-blocking)

- Gagal memuat daftar (GET list) memakai `OpsListErrorBanner` di atas tabel, bukan modal.
- State: `listError: string | null`; kosongkan saat fetch berhasil.
- Sediakan aksi **Coba lagi** dan **Tutup**.

## Auto numbers & tarif pengiriman (Shard J)

- `DEFAULT_PIECES = 1` — koli tidak diinput operator; selalu 1 di payload.
- `buildShipmentSubmitPayload()` di `src/lib/shipment-payload.ts` menormalkan:
  - `pieces`, `cargoMode`, `vehicleType`
  - `shippingRate` via `computeShippingRate({ serviceType, weightKg, origin, destination, aircraftType })` dari `constants.ts`
  - Bandara asal readonly = stasiun aktif user; tujuan, berat, layanan, dan pesawat mempengaruhi tarif
  - `awb` kosong (server generate), `flightId` / `customerAccountId` nullable
- Dipakai di: `validators.ts`, `client-validation.ts`, API `/api/shipments`, form ledger.
- Field **Tarif Pengiriman** readonly + tooltip `SHIPPING_RATE_TOOLTIP` (label `title` + `form-help`).

## Error aksi (tetap modal)

- Gagal POST/PATCH/DELETE atau koneksi saat submit tetap `showAlert` (blocking) agar operator sadar aksi tidak tersimpan.

## Dashboard tenang (Pusat Kendali)

Ringkasan dasbor operator harus tetap tenang saat data sekunder gagal dimuat.

| Area | Pola |
|------|------|
| Layout | Satu layar ringkasan saja; tanpa tab Ringkasan / Aktivitas / Peringatan |
| Fetch peringatan | `alertsOnly` gagal = **silent** (`failure: "none"`); tidak banner, tidak toast |
| Panel kanan | Hanya **Status Pesawat**; panel Peringatan inline dihapus |
| KPI "Belum Ditindak" | Tetap link ke `/alerts`; hitungan dari fetch diam di background |
| Toast | `OpsToast` solid (tanpa glass/blur); hanya untuk aksi operator, bukan kegagalan fetch peringatan |
| Gagal KPI utama | Banner error di shell atau slow-load warning saat bootstrap; ini satu-satunya umpan balik blocking di dasbor |

Regresi dicegah lewat `pnpm qa:dashboard-invariants` (static) dan `pnpm qa:dashboard-calm` (Playwright: abort `alertsOnly`, pastikan tanpa banner/toast/tab).