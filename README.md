# CapCut Store Web - Jasa Beli & Aktivasi Akun CapCut Pro

Website **Jasa Beli & Aktivasi Akun CapCut Pro** dengan Sistem Saldo, Topup Manual, Login/Daftar Member, Pengiriman Kredensial Manual oleh Admin, Live Chat Support, Voucher Diskon, dan Panel Admin Lengkap.

---

## Fitur Unggulan

1. **Jasa Aktivasi CapCut Pro (Pengiriman Manual oleh Admin)**:
   - User memesan produk → saldo terpotong → pesanan masuk berstatus **"Menunggu Diproses"**.
   - Admin mengisi kredensial akun asli di Panel Admin (menu **Pesanan Masuk**) → klik **Kirim Kredensial**.
   - Status berubah menjadi **"Selesai / Dikirim"** dan kredensial tampil di halaman **Akun Saya** milik user.
   - Admin juga dapat **membatalkan pesanan** (saldo otomatis dikembalikan ke pembeli).
2. **Sistem Saldo & Top Up (Manual + Flowix Otomatis)**:
   - **Manual**: Member mengajukan tiket deposit, transfer manual (QRIS / DANA / GoPay / Bank BCA), lalu upload bukti. Admin meng-approve / reject tiket deposit.
   - **Flowix Gateway Otomatis** (https://flowix.web.id): topup via QRIS & Virtual Account. Saldo otomatis masuk setelah pembayaran terverifikasi (polling status + webhook). Konfigurasi di Panel Admin → Pengaturan.
3. **Login & Daftar Member**:
   - Registrasi mandiri, login, dan halaman "Akun Saya".
4. **Katalog Daftar Harga (List Produk)**: Produk ditampilkan sebagai daftar harga per baris (nama, deskripsi, stok, harga, tombol beli), bukan kartu paket.
5. **Manajemen Stok Produk**: Setiap produk punya jumlah stok tersedia. Stok otomatis berkurang saat pesanan dibuat, dikembalikan saat pesanan dibatalkan, dan produk otomatis berlabel **"Stok Habis"** saat stok 0 (tombol beli dinonaktifkan). Admin dapat mengatur stok di menu **Kelola Produk**.
6. **Voucher Diskon**: Potongan persen atau nominal dengan kuota & minimal order.
7. **Live Chat Support**: Widget chat antara member/guest dan admin.
8. **Panel Admin Lengkap**:
   - Konfirmasi deposit, kirim kredensial pesanan, kelola produk (termasuk stok), voucher, pengguna & saldo, serta pengaturan website + metode pembayaran.

---

## Cara Install & Menjalankan

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Konfigurasi Environment (`.env`)**:
   - Salin `.env.example` menjadi `.env` lalu sesuaikan:
   ```env
   PORT=3000
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   SITE_DOMAIN=http://localhost:3000

   # Flowix Payment Gateway (opsional, bisa juga diisi via Panel Admin)
   FLOWIX_API_KEY=your_flowix_api_key
   FLOWIX_MERCHANT_ID=your_flowix_merchant_id
   FLOWIX_WEBHOOK_SECRET=your_flowix_webhook_secret
   ```
   - **Webhook Flowix**: daftarkan URL `https://domain-anda.com/webhook/flowix` di dashboard Flowix.

3. **Jalankan server**:
   ```bash
   npm start
   ```

4. **Buka browser**:
   ```
   http://localhost:3000
   ```

---

## Akun Default

- **Admin**: username `admin` / password `admin123`
- **Demo Member**: username `demo_user` / password `password123`

---

## Struktur Proyek

```
capcut-store-web/
├── server.js          # Backend Express (API, pesanan, pengiriman kredensial, topup, admin)
├── database.json      # Database JSON (users, packages, orders, topups, dst)
├── package.json
├── .env.example
└── public/
    ├── index.html     # UI website
    └── app.js         # Logic frontend
```
