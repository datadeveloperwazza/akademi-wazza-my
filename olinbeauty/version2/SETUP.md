# Olin Beauty Inventori V2 — Panduan Setup & Deploy

Sistem = **Google Sheet** (database) + **Apps Script** (`Code.gs`, semua logik) + **`index.html`** (paparan, host luar).

---

## Bahagian A — Backend (Apps Script + Sheet)

1. **Cipta Google Sheet baru** (nama bebas, cth. `OLIN BEAUTY INVENTORI V2`).
2. Menu **Extensions → Apps Script**. Padam kod contoh, **tampal seluruh `Code.gs`**, klik **Save** (💾).
3. (Disyorkan) Tetapkan zon masa: dalam editor Apps Script → **Project Settings (⚙️)** → **Show appsscript.json** → set:
   ```json
   "timeZone": "Asia/Kuala_Lumpur"
   ```
4. Dalam editor, pilih fungsi **`setupOlinSheets`** pada dropdown atas → klik **Run**.
   - Kali pertama akan minta **kebenaran (Authorize)** → benarkan akaun Google anda.
   - Selesai: semua tab (LEDGER, DOC_HEADER, MASTER_PRODUK, …) tercipta + 1 admin lalai.
5. **Deploy:** butang **Deploy → New deployment** → jenis **Web app**:
   - **Execute as:** *Me* (akaun anda)
   - **Who has access:** *Anyone*
   - **Deploy** → salin **Web app URL** (berakhir dengan `/exec`).

> **Penting setiap kali kemas kini `Code.gs`:** Deploy → **Manage deployments** → edit (✏️) → **Version: New version** → Deploy. Kalau lupa, perubahan kod **tidak** akan jalan.

---

## Bahagian B — Frontend (`index.html`)

1. Buka `index.html`, cari baris:
   ```js
   const GAS_URL = "PASTE_WEB_APP_URL_HERE";
   ```
   Ganti dengan **Web app URL** dari Bahagian A langkah 5.
2. **Host** fail `index.html` (jangan buka terus `file://` — fetch akan gagal):
   - Paling mudah: seret fail ke **Netlify Drop** (netlify.com/drop), atau
   - Letak di cPanel / mana-mana static hosting.
3. Buka URL hosting → skrin **Log Masuk** muncul.

---

## Login lalai (M0)

| Medan | Nilai |
|---|---|
| ID Staf | `STF-01` |
| PIN | `123456` |

> ⚠️ **Tukar PIN admin** sebaik sahaja modul Master siap (M5). Buat masa ini ia cukup untuk uji M0.

---

## Uji cepat M0

- Log masuk → patut nampak skrin **"Hari Ini"** dengan status hijau "Sistem berfungsi".
- Klik menu lain (Stok, DO, dll.) → papar placeholder "akan datang" (betul untuk M0).
- Log keluar → kembali skrin login.
- Uji API mentah: buka `WEB_APP_URL/exec` terus di browser → patut nampak
  `{"status":"OK","message":"Olin Beauty API v2 ... running."}`.

---

## Status pembinaan

| Milestone | Skop | Status |
|---|---|---|
| **M0** | Setup sheet, router, auth/sesi, helper teras | ✅ siap |
| **M1** | Master CRUD + enjin baki + seed 50 produk | ✅ siap |
| **M2** | Stok Masuk (GRN) + paparan Stok | ✅ siap |
| **M3** | DO Ejen (FEFO, picking list, WhatsApp, cetak) | ✅ siap |
| **M4a** | Bayaran + Akaun Ejen (hutang/kredit/ranking) | ✅ siap |
| **M4b** | Transfer + Jualan Outlet + Return + Pos | ✅ siap |
| **M5** | VOID + Integrity checker (I1–I9) + Kiraan stok + Ledger audit | ✅ siap |
| **M6** | Dashboard + Ringkasan Bulanan + trigger (backup/keepWarm/integriti) | ✅ siap |

### Nota M5
- **Dokumen (`#/dokumen`)** — senarai semua dokumen + detail penuh (lines, ledger, bayaran, pos) + butang **VOID** (Admin; staf warehouse boleh void dokumen sendiri hari sama, tiada bayaran — toggle `void_warehouse_hari_sama`). Void DO berbayar disekat: void bayaran/return dahulu.
- **Kiraan Stok (`#/kiraan`)** — blind count: staf isi qty fizikal tanpa nampak angka sistem; boleh tambah "batch ditemui"; Admin lulus → jana ADJ (varians) + GRN PENEMUAN automatik. Kiraan basi (stok bergerak sejak sesi dimula) ditolak.
- **Ledger (`#/ledger`)** — audit trail mentah + baki berlari + footer Σ MASUK − Σ KELUAR = BAKI (Admin sahaja).
- **Semak Integriti** — butang di Master → Tetapan: 9 invariant (I1–I9), lencana HIJAU/MERAH. Rebuild Counters di sebelahnya jika I7 lapor counter drift.

### Nota M6
- **Hari Ini (S1)** — strip status hidup: DO hari ini, jualan hari ini, DO belum pos (tap → Pos), badge integriti + expiry + bawah min, 10 DO terkini.
- **Dashboard (`#/dashboard`)** — Admin: 4 KPI (nilai stok / jualan bulan / kutipan bulan / hutang), Pending Payment per ejen, Ranking Ejen (bar % target), Stok Laju / Risiko Habis / Slow Moving, Expiry, picker bulan + **Ringkasan Bulanan** (BUKAN P&L — angka dikira-pada-baca). Staf warehouse dapat versi ringkas (ditapis server).

### Trigger automatik (WAJIB selepas deploy akhir)
1. Dalam editor Apps Script, pilih fungsi **`setupTriggers`** → **Run** (sekali sahaja).
   - Memasang: `keepWarm` (5 minit — elak cold start), `backupHarian` (1 pagi), `semakIntegritiHarian` (6 pagi — e-mel admin jika KRITIKAL).
2. **Tetapan disyorkan** (sheet SETTINGS atau skrin Tetapan):
   - `backup_folder_id` — ID folder Google Drive untuk simpan backup harian (buat folder, salin ID dari URL). Kosong = backup ke root My Drive (berfungsi tapi lambat & bersepah).
   - `admin_email` — e-mel untuk notifikasi integriti/backup gagal. Kosong = guna e-mel akaun deploy.

Rujuk `DESIGN-V2.md` untuk spesifikasi penuh.
