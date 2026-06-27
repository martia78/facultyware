# Facultyware — Sistem Pengajuan Pengunduran Diri Mahasiswa

Aplikasi web untuk mengelola proses pengajuan pengunduran diri mahasiswa secara digital. Mahasiswa dapat mengajukan permohonan beserta dokumen pendukung, yang kemudian diproses melalui alur persetujuan berjenjang oleh Kaprodi dan WD1, serta dikelola oleh Admin.

## Fitur Utama

- **Mahasiswa** — Mengajukan, mengedit, dan memantau status permohonan pengunduran diri; mengunduh surat dalam format PDF.
- **Kaprodi** — Meninjau dan menyetujui/menolak permohonan mahasiswa di bawah program studinya.
- **WD1** — Persetujuan tingkat akhir sebelum permohonan dinyatakan selesai.
- **Admin** — Manajemen pengguna (tambah, hapus, reset password).
- **Autentikasi & Otorisasi** — Session-based login dengan RBAC (Role-Based Access Control) berbasis permission.
- **Keamanan Dokumen** — File upload tidak dapat diakses langsung via URL; harus melalui endpoint yang dilindungi ACL.

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Template Engine | EJS |
| Styling | Tailwind CSS (via Basecoat) |
| Interaktivitas | HTMX |
| Database | MySQL 8 |
| Session Store | express-mysql-session |
| Auth | Session + JWT (untuk API) |
| Upload | Multer |
| PDF Generation | PDFKit |
| Testing | Playwright |

## Prasyarat

Pastikan sudah terinstal di mesin Anda:

- **Node.js** v18 atau lebih baru
- **MySQL** 8.0 atau lebih baru
- **npm** v9 atau lebih baru

## Instalasi & Menjalankan Aplikasi

### 1. Clone repository

```bash
git clone <url-repository>
cd facultyware
```

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi environment

Salin file contoh environment dan sesuaikan isinya:

```bash
cp .env.example .env
```

Buka `.env` lalu isi nilai yang sesuai:

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=facultyware

# Session
SESSION_SECRET=ganti_dengan_string_acak_yang_panjang_dan_aman

# JWT
JWT_SECRET=ganti_dengan_jwt_secret_yang_kuat
```

### 4. Siapkan database

Buat database MySQL dengan nama yang sama seperti nilai `DB_NAME` di `.env`:

```sql
CREATE DATABASE facultyware CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Kemudian jalankan migrasi/seed (jika tersedia):

```bash
npm run seed
```

### 5. Jalankan aplikasi

**Mode development** (dengan auto-reload):

```bash
npm run dev
```

**Mode production:**

```bash
npm start
```

Aplikasi akan berjalan di `http://localhost:3000` (atau port sesuai `.env`).

## Struktur Direktori

```
facultyware/
├── app.js                  # Entry point & konfigurasi middleware
├── bin/www                 # HTTP server launcher
├── controllers/            # Logic handler per role
│   ├── adminController.js
│   ├── kaprodiController.js
│   ├── mahasiswaController.js
│   ├── wd1Controller.js
│   ├── submissionController.js
│   └── ...
├── routes/                 # Definisi endpoint per role
│   ├── admin.js
│   ├── kaprodi.js
│   ├── mahasiswa.js
│   ├── wd1.js
│   └── api/
├── middlewares/
│   ├── acl.js              # RBAC (checkPermission, authorize)
│   ├── auth.js             # isAuthenticated, isGuest
│   ├── jwtAuth.js          # JWT middleware untuk API
│   └── validate.js         # Validasi input
├── lib/
│   ├── db.js               # Koneksi MySQL (connection pool)
│   ├── submissionModel.js  # Query model untuk permohonan
│   └── uploadConfig.js     # Konfigurasi Multer
├── views/                  # Template EJS
├── public/                 # Static assets (CSS, JS, images)
└── uploads/                # File upload (tidak diakses langsung)
```

## Peran & Hak Akses

| Role | Akses |
|---|---|
| `mahasiswa` | Buat & kelola permohonan sendiri |
| `kaprodi` | Lihat & setujui/tolak permohonan mahasiswa |
| `wd1` | Persetujuan akhir permohonan |
| `admin` | Manajemen seluruh pengguna |

## Pembagian Tugas Anggota Tim

| Nama | NIM | Tugas |
|---|---|---|
| Martia Perdana Putri | 2411522019 | Formulir Permohonan, Tracking Status, Riwayat Permohonan, Dashboard Kaprodi, Persetujuan/Penolakan Kaprodi |
| Ysmayyl Kakajanov | 2411528001 | Dashboard WD1, DAshboard Admin Persetujuan/Penolakan WD1, Pencarian & Filter, Manajemen Pengguna |
