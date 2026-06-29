# KasirQu - Sistem Kasir POS & Inventaris Modern

Aplikasi kasir (Point of Sale) digital berbasis web dengan database **Google Sheets** menggunakan **Google Apps Script (GAS)** sebagai API backend, dan frontend modern yang dideploy di **Vercel**.

## 🚀 Alur Kerja Sistem

1. **Frontend (Vercel)**: Melayani antarmuka kasir (POS), produk, stok masuk, riwayat transaksi, dan laporan analitis.
2. **Backend API (Google Apps Script)**: Menerima request POST/GET dari Vercel, membaca/menulis data secara aman menggunakan *Lock Service* ke Google Sheets.
3. **Database (Google Sheets)**: Menyimpan tabel `Users`, `Products`, `Transactions`, `StockIn`, dan `AuditLog`.

---

## 🛠️ Langkah-Langkah Penyiapan

### Bagian 1: Konfigurasi Database & API (Google Sheets & Apps Script)
1. Buat sebuah **Spreadsheet baru** di Google Sheets.
2. Klik **Ekstensi** > **Apps Script**.
3. Hapus semua kode bawaan di editor, lalu buat berkas baru bernama `Kode.gs` (atau biarkan `Kode.gs` bawaan) dan salin seluruh isi berkas dari `Kode.js` di repositori ini ke editor Apps Script tersebut.
4. Klik ikon **Simpan** (floppy disk).
5. Klik tombol **Deploy** di kanan atas > pilih **New deployment**.
6. Klik ikon gir (Select type) > pilih **Web app**.
7. Konfigurasikan sebagai berikut:
   - **Description**: KasirQu API v1
   - **Execute as**: **Me (email Anda)**
   - **Who has access**: **Anyone** (Ini penting agar Vercel dapat mengakses API secara publik).
8. Klik **Deploy** dan setujui izin jika diminta oleh Google.
9. **PENTING**: Salin **Web app URL** yang diberikan (contoh: `https://script.google.com/macros/s/.../exec`).
10. Di Editor Apps Script, jalankan fungsi `setupDatabase` sekali untuk membuat sheet database awal (`Users`, `Products`, dll) secara otomatis di Google Sheet Anda.

---

### Bagian 2: Deployment Frontend (Vercel)
1. Push proyek lokal Anda ke repositori **GitHub** baru.
2. Masuk ke dashboard [Vercel](https://vercel.com/) dan buat project baru.
3. Hubungkan ke repositori GitHub Anda dan impor.
4. Klik **Deploy**. Vercel akan otomatis menyajikan `index.html` sebagai halaman utama.
5. Setelah dideploy, buka tautan aplikasi Vercel Anda.
6. Saat pertama kali dibuka di Vercel, aplikasi akan mendeteksi lingkungan eksternal dan menampilkan modal konfigurasi API secara otomatis.
7. Masukkan **Web app URL** dari Google Apps Script yang sudah Anda salin di langkah sebelumnya, lalu klik **Simpan & Hubungkan**.
8. Aplikasi siap digunakan! Login bawaan:
   - **Username**: `admin`
   - **Password**: `Admin@2026`

---

## 📂 Berkas Proyek

Berikut adalah berkas-berkas dalam repositori ini:
* `index.html`: Berkas frontend utama berisi UI Kasir, Dashboard, Transaksi, dll.
* `Kode.js`: Berkas backend Google Apps Script (tulis/baca Google Sheets & Manajemen Sesi).
* `.gitignore`: Konfigurasi Git untuk mengabaikan berkas sampah.
* `rencana.md`: Dokumen perencanaan pengembangan proyek.
