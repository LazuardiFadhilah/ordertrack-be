# OrderTrack BE

Backend API dummy untuk tracking proses Order-to-Cash.

## Stack

- Node.js 20+, Express 5, Mongoose 8
- MongoDB untuk lingkungan persistent
- Vercel serverless entry: `api/index.js`

## Development

```bash
npm ci
npm start
```

## Checks

```bash
npm run check
npm test
```

## Dummy seed

Seed script diperiksa dan dipisahkan dari test/build. Tidak ada credential di script.

```bash
SEED_PASSWORD='<local-only-password>' npm run seed:users
SEED_DEMO=true npm run seed:demo
```

Kedua command memerlukan `.env` lokal dengan target database yang disetujui. `seed:demo` menulis hanya nama, kontak, NPWP, dan dokumen dummy; jangan jalankan ke database berisi data nyata tanpa persetujuan terpisah.

## Environment

```bash
cp .env.example .env
```

Isi `MONGODB_URI`, `JWT_SECRET`, dan konfigurasi cookie hanya di environment lokal/Vercel. Jangan commit `.env`, URI Atlas, JWT secret, atau credential lain.

Health check: `curl -i http://localhost:3000/api/health`

## Docs

- `docs/API.md` — kontrak endpoint
- `docs/ENV.md` — konfigurasi environment dan deployment
- `scripts/seed-users.js` — user dummy per role
- `scripts/seed-demo.js` — master data, quotation, dan SO dummy

Semua data pengembangan harus dummy. Jangan masukkan data perusahaan, customer, vendor, atau dokumen asli.