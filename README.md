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
- Neon PostgreSQL untuk development dan deployment persisten
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
- `customer@skyhub.test` / `operator123`

## Catatan

- Gunakan Neon sebagai sumber data utama dengan `DATABASE_PROVIDER=postgresql`.
- Set `DATABASE_URL` ke connection string Neon sebelum `prisma:generate`, `db:push`, dan `build`.
- Untuk fallback lokal, set manual `DATABASE_PROVIDER=sqlite` dan `DATABASE_URL=file:./dev.db`.
- `BLOB_READ_WRITE_TOKEN` opsional saat local. Jika kosong, upload dokumen memakai fallback lokal ke `public/uploads`.
- Di production tanpa `BLOB_READ_WRITE_TOKEN`, upload dokumen fallback ke runtime storage `/tmp` dan disajikan melalui route handler.
- Export PDF memakai print view browser agar tetap ringan dan mudah dipakai lokal maupun di deployment.
