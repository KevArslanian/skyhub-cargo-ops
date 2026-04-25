# SkyHub

Admin web app cargo udara untuk control room dengan fokus:

- dashboard staff operasional
- shipment ledger
- AWB tracking
- flight board
- activity log
- settings dan notifikasi persisten

## Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL / Neon sebagai database utama
- Vercel Blob untuk dokumen production

## Menjalankan Lokal

1. Install dependency

```bash
pnpm install --frozen-lockfile
```

2. Siapkan env database Postgres/Neon

```bash
cp .env.example .env
```

Isi minimal:

- `DATABASE_PROVIDER=postgresql`
- `DATABASE_URL=<neon pooled url>`
- `DATABASE_URL_UNPOOLED=<neon direct url>`
- `SESSION_SECRET=<secret panjang>`

3. Generate Prisma client, apply migration, dan seed data

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

4. Jalankan dev server

```bash
pnpm dev
```

## Demo Login

- `customer@skyhub.test` / `operator123`
- `staff@skyhub.test` / `operator123`
- `staff2@skyhub.test` / `operator123`
- `admin@skyhub.test` / `operator123`

## Akun Seed Tambahan

- `invited-staff@skyhub.test` / `operator123`
- `disabled-staff@skyhub.test` / `operator123`

## Catatan Neon dan Vercel

- Set `DATABASE_PROVIDER=postgresql`.
- Arahkan `DATABASE_URL` ke connection string Neon pooled untuk runtime aplikasi.
- Gunakan `DATABASE_URL_UNPOOLED` untuk migrasi bila workflow deployment Anda memerlukannya.
- Wajib isi `DATABASE_PROVIDER`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, dan `SESSION_SECRET` pada environment `Production`, `Preview`, dan `Development` di Vercel.
- Untuk migrasi dengan URL direct/unpooled, gunakan `pnpm db:migrate:unpooled`.
- Untuk validasi final, gunakan `pnpm db:migrate`; `pnpm db:push` hanya cocok untuk scratch/local reset yang tidak menjadi source of truth migration.
- Tidak ada fallback otomatis ke SQLite demo. Build, migrate, seed, dan runtime harus memakai `DATABASE_URL`.
- `BLOB_READ_WRITE_TOKEN` opsional saat local. Jika kosong, upload dokumen memakai fallback lokal ke `public/uploads`.
- Di production, `BLOB_READ_WRITE_TOKEN` wajib diisi. Upload/download/delete dokumen akan menolak operasi dengan status `503` jika token Blob belum dikonfigurasi.
- Output PDF tetap menggunakan print view browser agar ringan dan konsisten dengan data operasional.

## Auto-Migration (GitHub Actions + Neon)

Workflow: `.github/workflows/neon-migrate.yml`

- Preview branch/PR menjalankan migrasi dengan Neon Preview.
- Push ke `main` menjalankan migrasi dengan Neon Production.
- Migrasi selalu memakai URL unpooled melalui script `pnpm db:migrate:unpooled`.

Secrets yang wajib di GitHub:

- `NEON_PREVIEW_DATABASE_URL`
- `NEON_PREVIEW_DATABASE_URL_UNPOOLED`
- `NEON_PRODUCTION_DATABASE_URL`
- `NEON_PRODUCTION_DATABASE_URL_UNPOOLED`

## Shared Print Package

- Print Center shared UI sekarang berasal dari package eksternal: `@deltaoga/skyhub-print-center`.
- Source package: [https://github.com/KevArslanian/skyhub-print-center](https://github.com/KevArslanian/skyhub-print-center)
- Upgrade versi: update tag dependency `github:KevArslanian/skyhub-print-center#vX.Y.Z` lalu jalankan `pnpm install`.
- Import pattern: util dari root package, komponen layout dari `@deltaoga/skyhub-print-center/layout`.
- Asset default logo package: `/skyhub-mark-blue.svg` (bisa override via `brandMarkSrc`).
