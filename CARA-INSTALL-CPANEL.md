# Cara Install CapCut Store Web di cPanel

Aplikasi ini berbasis **Node.js (Express)**, bukan PHP. Jadi **hosting cPanel Anda harus mendukung Node.js**.

- Jika cPanel punya menu **"Setup Node.js App"** (CloudLinux) → ikuti **Metode A** (paling mudah, disarankan).
- Jika cPanel hanya punya **Phusion Passenger** (tanpa Node.js Selector) → ikuti **Metode B**.
- Jika cPanel **hanya PHP/statis** (tidak ada Node.js sama sekali) → aplikasi ini **tidak bisa jalan**. Perlu VPS/Pterodactyl atau hosting Node.js.

---

## Persiapan Umum (semua metode)

1. **Upload & extract**
   - Buka **File Manager** cPanel → masuk ke folder yang diinginkan (mis. `/home/USERNAME/capcut-store-web`).
   - Upload file `capcut-store-web.zip` → klik kanan → **Extract**.

2. **Install dependency**
   - Lewat menu Node.js App biasanya otomatis saat "Run NPM Install".
   - Atau via **Terminal**: masuk ke folder aplikasi lalu jalankan
     ```bash
     npm install
     ```

3. **Environment Variables** (isi di UI cPanel atau file `.env`)
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   SITE_DOMAIN=https://domain-anda.com

   FLOWIX_API_KEY=sk-xxxxxxxx
   FLOWIX_MERCHANT_ID=MID-xxxxxx
   FLOWIX_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```
   > `PORT` biasanya diisi otomatis oleh cPanel/Passenger. Jangan di-set manual kecuali diminta.

4. **Hak akses file database**
   - Set **`database.json`** menjadi writable (chmod **644** atau **666**) karena aplikasi menyimpan data ke file ini.

5. **Webhook Flowix**
   - Daftarkan URL `https://domain-anda.com/webhook/flowix` di dashboard Flowix.

---

## Metode A — Setup Node.js App (CloudLinux) — DISARANKAN

1. cPanel → **Software** → **Setup Node.js App** → **Create Application**.
2. Isi:
   - **Node.js version**: 18 atau lebih baru.
   - **Application mode**: Production.
   - **Application root**: `capcut-store-web` (folder hasil extract).
   - **Application URL**: pilih domain/subdomain Anda.
   - **Application startup file**: `server.js`.
3. Klik **Create**, lalu **Run NPM Install**.
4. Tambahkan **Environment Variables** (lihat Persiapan Umum no.3) di bagian Environment variables, lalu **Restart**.
5. Buka domain Anda di browser. Selesai.

> Tidak perlu file `.htaccess` untuk metode ini.

---

## Metode B — Phusion Passenger via .htaccess

1. Pastikan hosting mendukung Passenger untuk Node.js.
2. Rename file **`.htaccess.example`** menjadi **`.htaccess`**, lalu edit:
   - Ganti `USERNAME` dengan username cPanel Anda.
   - Sesuaikan versi Node (angka `18`) dengan yang tersedia.
   Contoh isi:
   ```apache
   PassengerAppRoot /home/USERNAME/capcut-store-web
   PassengerBaseURI /
   PassengerAppType node
   PassengerStartupFile server.js
   PassengerNodejs /home/USERNAME/nodevenv/capcut-store-web/18/bin/node
   PassengerAppLogFile /home/USERNAME/capcut-store-web/passenger.log
   ```
3. Buat file `.env` di folder aplikasi (isi seperti Persiapan Umum no.3).
4. Install dependency: `npm install`.
5. Set `database.json` writable, lalu buka domain Anda.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Halaman blank / 500 | Cek log: `passenger.log` atau menu Node.js App → Log. Pastikan `npm install` sudah jalan. |
| "Cannot find module 'express'" | Dependency belum terinstall. Jalankan `npm install`. |
| Perubahan data tidak tersimpan | `database.json` tidak writable. chmod 644/666. |
| Saldo tidak masuk saat topup Flowix | Cek `FLOWIX_API_KEY`, `FLOWIX_MERCHANT_ID`, whitelist IP di dashboard Flowix, dan URL webhook. |
| Tidak ada menu "Setup Node.js App" | Hosting tidak mendukung Node.js. Gunakan VPS/Pterodactyl. |

---

## Akun Default

- **Admin**: `admin` / `admin123`  (segera ganti demi keamanan!)
- **Demo Member**: `demo_user` / `password123`
