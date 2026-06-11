# Operator UX Pattern

Pola layout dan umpan balik untuk halaman CRUD operator SkyHub Ops.

## Zero-scroll + drawer popup

Halaman operator **tidak boleh scroll** (`html`, `.app-main-scroll`, `.ops-locked-page`).

| Aksi | Pola |
|------|------|
| List / tabel | `OPS_LIST_PAGE_SIZE` (6 baris) + `PaginationBar` |
| Klik baris | `OpsDrawer` atau `OpsDetailDrawer` (detail, boleh scroll internal) |
| Buat / Ubah | `OpsDrawer` form (boleh scroll internal) |
| Dilarang | Split-pane kanan permanen, accordion expand di halaman, `.page-scroll` vertikal di viewport |

Acuan: `flight-board/page.tsx`, `alerts/page.tsx`, `shipment-ledger/page.tsx` (pasca Shard L1).

```
CrudPageScaffold (viewport terkunci)
  ├── PageHeader + actions (Buat, Cetak, Riwayat, …)
  ├── FilterBar
  ├── body: tabel/list 6 baris
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
  - `shippingRate` via `computeShippingRate(serviceType, weightKg)` dari `constants.ts`
  - `awb` kosong (server generate), `flightId` / `customerAccountId` nullable
- Dipakai di: `validators.ts`, `client-validation.ts`, API `/api/shipments`, form ledger.
- Field **Tarif Pengiriman** readonly + tooltip `SHIPPING_RATE_TOOLTIP` (label `title` + `form-help`).

## Error aksi (tetap modal)

- Gagal POST/PATCH/DELETE atau koneksi saat submit tetap `showAlert` (blocking) agar operator sadar aksi tidak tersimpan.