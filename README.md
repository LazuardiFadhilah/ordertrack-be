# OrderTrack BE

Backend API OrderTrack untuk tracking proses Order-to-Cash.

## Stack

- Node.js 20+
- Express 5
- Mongoose 8
- JavaScript ES modules
- MongoDB Atlas
- Vercel serverless entry: `api/index.js`

## Development

```bash
npm ci
npm start
```

Server lokal berjalan di `http://localhost:3000` atau port dari `PORT`.

## Checks

```bash
npm run check
npm test
```

Health check:

```bash
curl -i http://localhost:3000/api/health
```

## Environment

```bash
cp .env.example .env
```

Isi `MONGODB_URI` hanya di file lokal atau Vercel Environment Settings. Jangan commit `.env`, URI Atlas, JWT secret, atau credential lain.

Health endpoint tidak membutuhkan koneksi MongoDB. Koneksi database memakai cache Mongoose untuk runtime serverless dan akan dipakai saat fitur domain mulai berjalan.

## Docs

- `docs/API.md` — kontrak endpoint
- `docs/ENV.md` — konfigurasi environment dan deployment
- `docs/tasks/TASK-002-server-scaffold-health.md` — scope BE fase fondasi
- `docs/QA-REPORT-002.md` — bukti QA fase 1

Semua data pengembangan harus dummy. Jangan masukkan data perusahaan, customer, vendor, atau dokumen asli.
