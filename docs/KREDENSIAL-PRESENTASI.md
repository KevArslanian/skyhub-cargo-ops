# SkyHub Cargo Ops — Kredensial & Skenario Presentasi

Dokumen siap copy-paste untuk demo SIWEB Kelas C (Operator Bandara).  
Semua akun seed memakai kata sandi yang sama kecuali sudah di-reset admin.

**Kata sandi default semua akun demo:** `operator123`

---

## 1. Jalankan aplikasi (sebelum presentasi)

```bash
cd /Users/macbookpro/Berkas/02-Projek-Koding/Skyhub/skyhub-cargo-ops-clone
pnpm db:migrate && pnpm db:seed
PORT=3100 pnpm dev
```

**Base URL lokal (disarankan saat presentasi):** `http://localhost:3100`

---

## 2. Blok cepat — copy paste langsung

### Operator utama (paling sering dipakai)

```
URL      : http://localhost:3100/login
Email    : staff@skyhub.test
Password : operator123
```

### Administrator (kelola user + reset password)

```
URL      : http://localhost:3100/login
Email    : admin@skyhub.test
Password : operator123
```

### Cek resi publik (tanpa login)

```
URL : http://localhost:3100/about-us#tracking
AWB : 160-10000001
```

### Reset password oleh admin (alur lupa password)

```
1. Login admin@skyhub.test / operator123
2. Pengaturan → Tim & Akses → Ubah (pada user target)
3. Isi kata sandi baru + konfirmasi → Terapkan reset kata sandi
4. Beri tahu staf kata sandi baru secara langsung
```

---

## 3. URL penting

| Tujuan | URL lokal |
|--------|-----------|
| Portal publik / landing | `http://localhost:3100/about-us` |
| Cek resi publik | `http://localhost:3100/about-us#tracking` |
| Login operator | `http://localhost:3100/login` |
| Dashboard | `http://localhost:3100/dashboard` |
| Pelacakan AWB internal | `http://localhost:3100/awb-tracking` |
| Buku pengiriman | `http://localhost:3100/shipment-ledger` |
| Papan penerbangan | `http://localhost:3100/flight-board` |
| Pusat peringatan | `http://localhost:3100/alerts` |
| Kotak keluhan | `http://localhost:3100/complaints` |
| Pengaturan | `http://localhost:3100/settings` |
| Catatan aktivitas | `http://localhost:3100/activity-log` |

**Production (Vercel):** `https://skyhub-cargo-ops.vercel.app`  
Gunakan lokal jika endpoint publik AWB di production belum 200.

---

## 4. Semua akun login

| Nama | Email | Password | Peran | Status | Stasiun | Kapan dipakai |
|------|-------|----------|-------|--------|---------|---------------|
| Mira Putri | `admin@skyhub.test` | `operator123` | Administrator | Aktif | SOQ | Demo admin, reset password, kelola tim |
| Raka Pratama | `staff@skyhub.test` | `operator123` | Staf Operasional | Aktif | SOQ | **Akun utama demo operator** |
| Naila Putri | `staff2@skyhub.test` | `operator123` | Staf Operasional | Aktif | SOQ | Staf kedua, stasiun sama |
| Aldi Saputra | `staff3@skyhub.test` | `operator123` | Staf Operasional | Aktif | CGK | Demo stasiun berbeda (CGK) |
| Laras Wibowo | `staff4@skyhub.test` | `operator123` | Staf Operasional | Aktif | SUB | Demo stasiun berbeda (SUB) |
| Staf Operasional 05 | `staff-extra-1@skyhub.test` | `operator123` | Staf Operasional | Aktif | SOQ | Akun tambahan seed |
| Dian Rahma | `invited-staff@skyhub.test` | `operator123` | Staf Operasional | Diundang | SOQ | Demo status belum aktif |
| Undangan Staf 02 | `invited-staff-2@skyhub.test` | `operator123` | Staf Operasional | Diundang | SOQ | Demo undangan kedua |
| Bagas Prasetyo | `disabled-staff@skyhub.test` | `operator123` | Staf Operasional | Nonaktif | SOQ | Demo akun dinonaktifkan |
| Staf Nonaktif 02 | `disabled-staff-2@skyhub.test` | `operator123` | Staf Operasional | Nonaktif | SOQ | Demo nonaktif kedua |
| Nadia Kusuma | `customer@skyhub.test` | `operator123` | Pelanggan | Aktif | SOQ | Akun pelanggan (bukan ruang operator) |
| Teguh Santoso | `customer2@skyhub.test` | `operator123` | Pelanggan | Aktif | CGK | Pelanggan stasiun CGK |
| Citra Melati | `customer3@skyhub.test` | `operator123` | Pelanggan | Aktif | DPS | Pelanggan stasiun DPS |

**Catatan login pelanggan:** role customer diarahkan ke portal publik, bukan ruang operator internal.

**Catatan lupa password:** tidak ada self-service. Staf menghubungi admin; reset lewat **Pengaturan → Tim & Akses**.

---

## 5. Kombinasi kredensial per skenario presentasi

### A. Portal publik + tracking AWB (Checklist #1 dan #2)

```
Buka   : http://localhost:3100/about-us#tracking
AWB    : 160-10000001
Hasil  : Status Diterima, rute SOQ → CGK, linimasa Cargo iQ + timestamp
```

Alternatif nomor resi demo (copy-paste langsung ke kolom pelacakan):

| AWB | Status (ID) | Rute |
|-----|-------------|------|
| `160-10000001` | Diterima | SOQ → CGK |
| `160-10000012` | Sortasi | SOQ → SUB |
| `160-10000023` | Muat ke Pesawat | SOQ → DPS |
| `160-10000034` | Berangkat | SOQ → UPG |
| `160-10000045` | Tiba | SOQ → BPN |
| `160-10000056` | Tertahan | SOQ → KNO |

Copy-paste AWB satu per satu:

```
160-10000001
160-10000012
160-10000023
160-10000034
160-10000045
160-10000056
```

### B. Masuk operator + dashboard (Checklist #3)

```
URL      : http://localhost:3100/login
Email    : staff@skyhub.test
Password : operator123
Lanjut   : http://localhost:3100/dashboard
```

### C. Sidebar + modul operasional (Checklist #4)

Login dulu:

```
staff@skyhub.test
operator123
```

Lalu buka berurutan:

```
/dashboard
/shipment-ledger
/awb-tracking
/flight-board
/alerts
/complaints
/settings
/activity-log
```

### D. Admin kelola tim + reset password

```
Email admin    : admin@skyhub.test
Password admin : operator123

Target reset   : staff@skyhub.test
Password baru  : (isi sendiri, min 6 karakter, contoh: SkyHub2026)
```

Narasi singkat:

> "Jika staf lupa kata sandi, tidak ada tombol lupa password mandiri. Administrator mengatur ulang lewat Pengaturan, Tim & Akses, lalu menyampaikan kata sandi baru secara langsung."

### E. Demo akun gagal login (error handling)

**Akun nonaktif:**

```
disabled-staff@skyhub.test
operator123
```

**Akun diundang:**

```
invited-staff@skyhub.test
operator123
```

**Kredensial salah (sengaja):**

```
staff@skyhub.test
salah-password
```

### F. Demo stasiun berbeda (scope data)

| Email | Stasiun | Password |
|-------|---------|----------|
| `staff@skyhub.test` | SOQ | `operator123` |
| `staff3@skyhub.test` | CGK | `operator123` |
| `staff4@skyhub.test` | SUB | `operator123` |

### G. Pelacakan internal setelah login

```
Login : staff@skyhub.test / operator123
Buka  : http://localhost:3100/awb-tracking?awb=160-10000012
```

### H. Keluhan publik (fitur tambahan)

```
Buka form : http://localhost:3100/about-us#complaints
Nama      : Budi Santoso
Kontak    : 081234567890
Topik     : Pengiriman / AWB
Referensi : 160-10000056
Pesan     : Status resi tertahan lebih dari estimasi operasional.
```

Setelah submit, cek di operator:

```
Login : staff@skyhub.test / operator123
Buka  : http://localhost:3100/complaints
```

---

## 6. Akun pelanggan (CustomerAccount) — referensi data

| Kode | Nama | Status |
|------|------|--------|
| NUSFRESH | PT Nusantara Fresh Cargo | Aktif |
| PAPUATECH | PT Papua Teknik Mandiri | Aktif |
| SAMUDRA | PT Samudra Distribusi Timur | Aktif |
| METROLINE | PT Metroline Partner | Aktif |
| BALIEXP | PT Bali Express Logistik | Aktif |
| KALTIMSUP | PT Kaltim Supply Chain | Aktif |
| HOLDACC01 | PT Arsip Pelanggan 01 | Nonaktif |

---

## 7. Urutan demo 5 menit (rekomendasi ke asdos)

1. **Publik:** `about-us#tracking` + AWB `160-10000001`
2. **Operator:** login `staff@skyhub.test` / `operator123`
3. **Dashboard:** KPI + peringatan
4. **Ledger:** buka satu shipment, tunjuk relasi data
5. **Admin (opsional):** login `admin@skyhub.test`, tunjuk reset password di Settings

---

## 8. Troubleshooting cepat

| Masalah | Solusi |
|---------|--------|
| Login gagal semua akun | Jalankan `pnpm db:seed` |
| AWB tidak ditemukan | Pakai AWB dari tabel bagian 5A |
| Lupa password staf | Admin reset di Settings, bukan self-service |
| Port 3100 sudah dipakai | Hentikan proses lama atau ganti `PORT=3101 pnpm dev` |
| Production AWB 401 | Presentasi pakai `localhost:3100` |

---

## 9. Cheat sheet satu baris

```
Publik AWB     : localhost:3100/about-us#tracking → 160-10000001
Operator       : staff@skyhub.test / operator123
Admin          : admin@skyhub.test / operator123
Reset password : Admin → Settings → Tim & Akses → Ubah user → Reset kata sandi
```

---

*Terakhir diselaraskan dengan seed + database Neon: Juni 2026.*