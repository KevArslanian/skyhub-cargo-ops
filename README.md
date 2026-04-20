# SkyHub

Admin web app cargo udara untuk operator control room dengan fokus:

- dashboard operator
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
- `operator@skyhub.test` / `operator123`
- `supervisor@skyhub.test` / `operator123`
- `admin@skyhub.test` / `operator123`

## Akun Seed Tambahan

- `invited-ops@skyhub.test` / `operator123`
- `disabled-supervisor@skyhub.test` / `operator123`

## Catatan Neon dan Vercel

- Set `DATABASE_PROVIDER=postgresql`.
- Arahkan `DATABASE_URL` ke connection string Neon pooled untuk runtime aplikasi.
- Gunakan `DATABASE_URL_UNPOOLED` untuk migrasi bila workflow deployment Anda memerlukannya.
- Untuk validasi final, gunakan `pnpm db:migrate`; `pnpm db:push` hanya cocok untuk scratch/local reset yang tidak menjadi source of truth migration.
- Tidak ada fallback otomatis ke SQLite demo. Build, migrate, seed, dan runtime harus memakai `DATABASE_URL`.
- `BLOB_READ_WRITE_TOKEN` opsional saat local. Jika kosong, upload dokumen memakai fallback lokal ke `public/uploads`.
- Di production tanpa `BLOB_READ_WRITE_TOKEN`, upload dokumen fallback ke runtime storage `/tmp` dan disajikan melalui route handler.
- Output PDF tetap menggunakan print view browser agar ringan dan konsisten dengan data operasional.
