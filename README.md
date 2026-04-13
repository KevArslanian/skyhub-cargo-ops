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
- SQLite untuk development lokal dan bundled demo deployment
- PostgreSQL untuk deployment persisten
- Vercel Blob untuk dokumen production

## Menjalankan Lokal

1. Install dependency

```bash
pnpm install
```

2. Generate Prisma client, push schema, dan seed data

```bash
pnpm prisma:generate
pnpm db:push
pnpm db:seed
```

3. Jalankan dev server

```bash
pnpm dev
```

## Demo Login

- `operator@skyhub.test` / `operator123`
- `supervisor@skyhub.test` / `operator123`
- `admin@skyhub.test` / `operator123`

## Catatan

- Local default memakai `DATABASE_PROVIDER=sqlite` dan `DATABASE_URL=file:./dev.db`.
- Untuk deployment persisten, ubah `DATABASE_PROVIDER=postgresql` dan arahkan `DATABASE_URL` ke instance Postgres Anda sebelum build.
- Jika env database deployment belum tersedia, app akan fallback ke bundled SQLite demo DB agar seluruh menu tetap hidup untuk review UI dan alur operator.
- `BLOB_READ_WRITE_TOKEN` opsional saat local. Jika kosong, upload dokumen memakai fallback lokal ke `public/uploads`.
- Di production tanpa `BLOB_READ_WRITE_TOKEN`, upload dokumen fallback ke runtime storage `/tmp` dan disajikan melalui route handler.
- Export PDF memakai print view browser agar tetap ringan dan mudah dipakai lokal maupun di deployment.
