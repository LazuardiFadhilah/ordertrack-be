# OrderTrack Phase 6 — Status Audit

Tanggal: 2026-11-17
Repos: `~/Code/ordertrack-be` dan `~/Code/ordertrack-fe`, branch `main`, perubahan lokal belum commit/merge.

## Ringkasan

Fase 6 **Invoicing & Customer Payment (AR)** sudah diimplementasikan di BE dan FE. Semua check/test/build lulus. UI mock QA lulus desktop & mobile setelah perbaikan tampilan daftar invoice di ponsel.

Sisa yang belum: verifikasi end-to-end terhadap backend nyata (Atlas) dan proses commit/merge ke `main`.

## Backend (`ordertrack-be`)

### Sudah
- Model: `Invoice`, `Payment` (`src/models/invoice.js`).
- Service: `src/services/invoice.js` — create invoice, list, detail, record payment.
- Routes: `src/routes/invoice.js` — mount di `/api/invoices`, payment di `/api/invoices/payments`.
- Validation: `src/validation/invoice.js` (Zod).
- App wiring: `src/app.js`.
- Test: `test/phase6.test.js` — create dari SO `SHIPPED`/`DO_RETURNED`/`COMPLETED`, partial payment, reject overpayment, full payment, SO jadi `PAID`.
- Hasil:
  - `npm run check` PASS
  - `npm test` 26/26 PASS
  - `git diff --check` PASS

### Kekurangan
- Belum diuji dengan database MongoDB nyata (Atlas). Test masih pakai memory model.
- Belum ada test spesifik untuk `401` (tanpa session) dan `403` (role SALES tidak boleh create/pay) pada endpoint Phase 6. Role middleware sudah ada secara umum, tapi coverage Phase 6 sendiri belum eksplisit.

## Frontend (`ordertrack-fe`)

### Sudah
- API client: `invoiceApi` + `paymentApi` di `lib/api-client.js`.
- Halaman: `/invoices` — list, filter status, search, responsive card di mobile + table di desktop.
- Nav: menu "Penagihan" di `app/(app)/layout.js`.
- Detail SO: tab "Invoice & pembayaran", tombol buat invoice, dialog catat pembayaran, riwayat pembayaran.
- Test: `test/api-client.test.js` menambahkan assert invoice/payment helpers.
- Mock API: `test/mock-api.mjs` menambahkan route invoice & payment untuk visual QA.
- Hasil:
  - `npm run check` PASS
  - `npm test` 25/25 PASS
  - `npm run build` PASS
  - `git diff --check` PASS

### Kekurangan
- Login fixture mock hanya pakai email; tidak merepresentasikan flow password nyata.
- Browser QA hanya berjalan dengan mock API, bukan backend Express + MongoDB nyata.

## Browser QA (mock API)

| Skenario | Status | Keterangan |
|---|---|---|
| Login AR fixture | PASS | Cookie `mock_role=AR` set, redirect ke `/invoices`. |
| List invoice | PASS | Desktop 1440x900 & mobile 375x812, tidak ada horizontal overflow. |
| Detail invoice di SO | PASS | Tab "Invoice & pembayaran" menampilkan invoice, total, sisa piutang. |
| Riwayat pembayaran | PASS | Muncul setelah payment tercatat. |
| Partial payment | PASS | Nominal tercatat, sisa piutang berkurang, status `PARTIALLY_PAID`. |
| Full payment | PASS | SO berubah jadi `LUNAS` / `PAID`, sisa piutang `Rp 0`. |
| Overpayment | PASS | Ditolak 409 oleh backend test; UI dialog memvalidasi maksimal sisa piutang. |

## Rekomendasi Sebelum Merge

1. Jalankan BE dengan MongoDB nyata (staging/dev) dan buat satu SO `SHIPPED`/`COMPLETED`, lalu uji invoice + payment via curl/Postman.
2. Jalankan FE dengan `API_SERVER_URL=<real-be>` dan uji login nyata sampai pelunasan.
3. Tambahkan test BE untuk `401`/`403` pada endpoint Phase 6 (opsional tapi disarankan).
4. Commit BE, commit FE, lalu merge ke `main` masing-masing repo.

## File yang berubah

### BE
- `package.json`
- `src/app.js`
- `test/support/memory-model.js`
- `src/models/invoice.js` (baru)
- `src/routes/invoice.js` (baru)
- `src/services/invoice.js` (baru)
- `src/validation/invoice.js` (baru)
- `test/phase6.test.js` (baru)

### FE
- `app/(app)/layout.js`
- `app/(app)/sales-orders/[id]/page.js`
- `lib/api-client.js`
- `test/api-client.test.js`
- `test/mock-api.mjs`
- `app/(app)/invoices/page.js` (baru)
- `app/(app)/sales-orders/[id]/payment-dialog.js` (baru)
