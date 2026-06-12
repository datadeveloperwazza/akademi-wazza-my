# Olin Beauty V2 — Senarai Semak UAT

**Sistem:** `olin-v2-M6-2026.06.12`  
**Penguji:** ___________________  
**Tarikh mula:** ___________  
**URL sistem:** ___________________

> **Cara guna:** Tandakan ✅ lulus, ❌ gagal (tulis nota), ⏭ langkau (sebab).  
> Selesaikan modul mengikut urutan M0 → M6 — setiap modul bergantung pada yang sebelumnya.

---

## PERSEDIAAN SEBELUM TEST

```
[ ] 1. Deploy Code.gs versi baru (New version) di Apps Script
[ ] 2. Confirm GAS_URL dalam index.html dah betul
[ ] 3. Run setupOlinSheets() sekali (jika sheet baru)
[ ] 4. Run setupTriggers() sekali
         → Apps Script editor → dropdown pilih "setupTriggers" → Run
         → Semak Apps Script > Triggers: mesti ada 3 (keepWarm, backupHarian, semakIntegritiHarian)
[ ] 5. Buka app → Master & Tetapan → Tetapan → isi dan simpan:
         - backup_folder_id  : ID folder Google Drive (dari URL folder: .../folders/<ID>)
         - admin_email       : e-mel penerima notifikasi integriti / backup gagal
         - backup_simpan_hari: 30 (atau ikut keperluan)
         - void_warehouse_hari_sama: pilih Ya atau Tidak
[ ] 6. Tukar PIN admin dari 123456 (Master → Staf → edit STF-01)
```

---

## M0 — Pengesahan & Sesi

### T01 · Login sah
**Langkah:** Buka app → masukkan ID `STF-01` + PIN admin  
**Jangkaan:** Masuk ke skrin "Hari Ini", nama staf terpapar  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T02 · Login gagal — PIN salah
**Langkah:** Cuba login dengan PIN `000000`  
**Jangkaan:** Mesej ralat "ID atau PIN tidak sah", tidak masuk  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T03 · Log keluar
**Langkah:** Klik Log Keluar  
**Jangkaan:** Kembali ke skrin login, sesi dipadam  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T04 · Akses tanpa sesi
**Langkah:** Padam cookie/session → cuba buka URL terus  
**Jangkaan:** Redirect ke skrin login  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M1 — Master Data

### T05 · Tambah produk baru
**Langkah:** Master → Produk → Tambah → isi SKU, Nama, Kategori, Kos, Harga Ejen  
**Jangkaan:** Produk tersimpan, muncul dalam senarai  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T06 · Edit produk (harga)
**Langkah:** Edit produk T05 → tukar harga_ejen_rm  
**Jangkaan:** Harga terkemas, updated_at berubah  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T07 · Tambah ejen baru
**Langkah:** Master → Ejen → Tambah → isi nama, no_tel, kawasan, target bulanan  
**Jangkaan:** Ejen tersimpan dengan ejen_id auto  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T08 · Tambah outlet baru
**Langkah:** Master → Outlet → Tambah → isi nama, alamat  
**Jangkaan:** Outlet tersimpan dengan outlet_id auto  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T09 · Tetapan sistem — nilai asas
**Langkah:** Master → Tetapan → semak field: Nama Syarikat, Amaran Expiry, Sesi Log Masuk, Min. Diskaun  
**Jangkaan:** Nilai tersimpan sebelum ni terpapar (bukan kosong), boleh dikemas dan disimpan  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T09b · Tetapan backup & notifikasi
**Langkah:** Master → Tetapan → isi `backup_folder_id` (ID folder Drive), `admin_email`, `backup_simpan_hari: 30` → Simpan → reload halaman → buka Tetapan semula  
**Jangkaan:** Nilai kekal (bukan kosong semula) — ini mengesahkan `PUBLIC_SETTINGS` backend menghantar key ini  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T09c · Toggle void staf WH
**Langkah:** Master → Tetapan → `void_warehouse_hari_sama` → tukar kepada **Tidak (NO)** → Simpan → reload → buka Tetapan  
**Jangkaan:** Dropdown kekal pada "Tidak (NO)", bukan balik ke Ya  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T10 · Alert expiry di Stok
**Langkah:** Buka skrin Stok → semak tab Expiry  
**Jangkaan:** Produk expiry < 30 hari terpapar (merah), 30–90 hari (kuning)  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M2 — Stok Masuk (GRN)

### T11 · GRN tanpa expiry
**Langkah:** Stok Masuk → Tambah → pilih produk (ada_expiry=NO) → qty 50 → kos RM10  
**Jangkaan:** GRN-OBSB#### tercipta, baki WH +50, LEDGER ada baris MASUK  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T12 · GRN dengan expiry
**Langkah:** GRN produk ada_expiry=YES → isi tarikh expiry bulan depan  
**Jangkaan:** Batch tercipta dengan tarikh expiry, batch_id dalam LEDGER  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T13 · GRN beberapa baris (multi-SKU)
**Langkah:** GRN dengan 3 SKU berbeza dalam satu dokumen  
**Jangkaan:** 1 DOC_HEADER, 3 DOC_LINES, 3 baris LEDGER  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T14 · Semak baki stok bertambah
**Langkah:** Catat baki sebelum T11 → semak baki selepas  
**Jangkaan:** Baki = baki sebelum + qty GRN  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M3 — DO Ejen

### T15 · DO standard
**Langkah:** DO Ejen → pilih ejen T07 → tambah produk T11 qty 5  
**Jangkaan:** DO-OBSB#### tercipta, baki WH −5, status AKTIF  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T16 · DO dengan diskaun %
**Langkah:** DO → diskaun 10% → semak jumlah_bersih = subtotal × 0.90  
**Jangkaan:** Kiraan sen tepat, tiada rounding liar  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T17 · DO dengan diskaun flat (RM)
**Langkah:** DO → diskaun RM5 → semak jumlah_bersih = subtotal − 5  
**Jangkaan:** Betul  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T18 · DO melebihi baki — disekat
**Langkah:** DO qty 9999 untuk produk yang baki < 9999  
**Jangkaan:** ERROR "Baki tidak mencukupi", DO tidak tercipta  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T19 · DO produk expiry hampir — amaran
**Langkah:** DO produk yang ada batch expiry < 60 hari  
**Jangkaan:** Skrin tunjuk amaran CONFIRM_EXPIRY, kena klik Sahkan untuk teruskan  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T20 · FEFO — expiry awal keluar dulu
**Langkah:** GRN 2 batch produk sama (expiry A: bulan depan, B: 6 bulan). DO qty 10  
**Jangkaan:** LEDGER papar batch A digunakan dulu (expiry lebih awal)  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T21 · Picking list & WhatsApp copy
**Langkah:** Buka DO yang baru → semak butang "Picking List" dan "WhatsApp"  
**Jangkaan:** Picking list terpapar dengan betul, teks WhatsApp tersalin  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M4a — Bayaran Ejen

### T22 · Bayar penuh satu DO
**Langkah:** Akaun Ejen → ejen T07 → Bayar → amaun = jumlah_bersih DO T15  
**Jangkaan:** DO T15 status bayar = LUNAS, baki_hutang = 0  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T23 · Bayar separa (2 DO)
**Langkah:** Buat 2 DO → bayar amaun yang cukup untuk DO 1 sahaja  
**Jangkaan:** DO 1 LUNAS, DO 2 TERTUNGGAK / SEPARA  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T24 · Bayaran lebih → kredit
**Langkah:** Bayar melebihi jumlah hutang semua DO aktif  
**Jangkaan:** Semua DO LUNAS, lebihan masuk baki_kredit_rm  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T25 · Void bayaran
**Langkah:** Akaun Ejen → senarai bayaran → void bayaran T22  
**Jangkaan:** Bayaran status VOID, DO kembali TERTUNGGAK  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T26 · Penyata ejen
**Langkah:** Akaun Ejen → pilih ejen → Penyata  
**Jangkaan:** Senarai DO + bayaran terpapar, baki hutang tepat  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M4b — Transfer, Jualan Outlet, Return, Lupus, Pos

### T27 · Transfer WH → Outlet
**Langkah:** Transfer → pilih outlet T08 → SKU → qty 20  
**Jangkaan:** WH −20, Outlet +20, batch_id sama di kedua LEDGER  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T28 · Transfer melebihi baki WH — disekat
**Langkah:** Transfer qty 9999  
**Jangkaan:** ERROR, transfer tidak berlaku  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T29 · Jualan Outlet
**Langkah:** Jualan Outlet → pilih outlet T08 → SKU → qty 5  
**Jangkaan:** Outlet −5, status LUNAS, tiada payment row (bayar terus)  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T30 · Jualan Outlet melebihi stok outlet — disekat
**Langkah:** Jualan Outlet qty > stok outlet  
**Jangkaan:** ERROR  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T31 · Return RTN_EJEN → RESTOCK
**Langkah:** Return → RTN_EJEN → ejen T07 → SKU qty 2 → disposisi RESTOCK  
**Jangkaan:** WH +2, KREDIT_RETURN tercipta auto (potong hutang)  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T32 · Return RTN_EJEN → ROSAK
**Langkah:** Return → RTN_EJEN → SKU qty 1 → disposisi ROSAK  
**Jangkaan:** ROSAK +1, WH tidak berubah  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T33 · Return RTN_OUTLET
**Langkah:** Return → RTN_OUTLET → outlet T08 → SKU qty 3 → RESTOCK  
**Jangkaan:** Outlet −3, WH +3  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T34 · Lupus dari ROSAK
**Langkah:** Lupus → pilih SKU yang ada di ROSAK → qty 1  
**Jangkaan:** ROSAK −1, LEDGER KELUAR (LUPUS), baki ROSAK berkurang  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T35 · Lupus melebihi ROSAK — disekat
**Langkah:** Lupus qty > baki ROSAK  
**Jangkaan:** ERROR  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T36 · Tambah Pos
**Langkah:** DO T15 → Pos → isi kurier, tracking, berat  
**Jangkaan:** POSTAGE_LOG tercipta, tracking number muncul dalam detail DO  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T37 · Hari Ini — strip "Belum Pos"
**Langkah:** Buat DO tanpa postage → semak Hari Ini  
**Jangkaan:** Strip "Belum Pos" tunjuk bilangan, tap bawa ke skrin Pos  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M5 — VOID, Integriti, Kiraan Stok, Ledger

### T38 · VOID GRN
**Langkah:** Dokumen → cari GRN → VOID → isi sebab (≥5 aksara)  
**Jangkaan:** GRN status VOID, baki WH berkurang semula, LEDGER ada baris is_reversal=YES  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T39 · VOID DO tanpa bayaran
**Langkah:** Buat DO baru (jangan bayar) → VOID  
**Jangkaan:** DO status VOID, baki WH pulih semula  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T40 · VOID DO ada bayaran — disekat
**Langkah:** Cuba VOID DO T22 (yang ada bayaran)  
**Jangkaan:** ERROR "Void bayaran dulu", DO tidak tervoid  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T41 · VOID RTN_EJEN → auto-void KREDIT_RETURN
**Langkah:** VOID return T31  
**Jangkaan:** RTN_EJEN VOID + KREDIT_RETURN berkaitan VOID dalam satu operasi  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T42 · VOID tidak boleh negatifkan baki
**Langkah:** GRN 5 unit → DO 5 unit → cuba VOID GRN  
**Jangkaan:** ERROR "Baki akan jadi negatif selepas void"  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T43 · Semak Integriti — sistem bersih
**Langkah:** Master → Tetapan → Semak Integriti  
**Jangkaan:** Lencana HIJAU, tiada anomali  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T44 · Dokumen — senarai & cari
**Langkah:** #/dokumen → tapis jenis DO_EJEN → semak senarai  
**Jangkaan:** Senarai terpapar, carian nama/doc_no berfungsi  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T45 · Dokumen — detail lengkap
**Langkah:** Tap mana-mana dokumen dalam senarai  
**Jangkaan:** Header + Lines + LEDGER rows + Bayaran + Postage terpapar  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T46 · Kiraan Stok — buat sesi & isi
**Langkah:** #/kiraan → Buat Sesi Baru → pilih lokasi → Simpan qty fizikal beberapa SKU  
**Jangkaan:** Sesi DRAF tercipta, staf tidak nampak qty sistem  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T47 · Kiraan Stok — Submit & Lulus
**Langkah:** Sambung T46 → Submit → Admin Lulus  
**Jangkaan:** ADJ + GRN PENEMUAN (jika ada) auto-jana, SC status DILULUSKAN  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T48 · Kiraan Stok — kiraan basi disekat
**Langkah:** Mula sesi kiraan → buat DO untuk SKU yang sama → cuba Lulus kiraan  
**Jangkaan:** ERROR "Kiraan basi — stok bergerak sejak sesi dimula"  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T49 · Kiraan Stok — Tolak
**Langkah:** Buat sesi kiraan baru → Submit → Admin Tolak → isi catatan  
**Jangkaan:** SC status DITOLAK, catatan tersimpan  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T50 · Ledger audit
**Langkah:** #/ledger → filter SKU tertentu  
**Jangkaan:** Semua pergerakan SKU tersenarai, baki berlari tepat, footer Σ betul  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## M6 — Dashboard & Ringkasan Bulanan

### T51 · Hari Ini (S1) — data hidup
**Langkah:** Buka skrin Hari Ini  
**Jangkaan:** Strip DO hari ini / Jualan / Belum Pos terpapar dengan angka betul  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T52 · Dashboard Admin — KPI
**Langkah:** #/dashboard (login sebagai admin)  
**Jangkaan:** 4 KPI terpapar: Nilai Stok, Jualan Bulan, Kutipan Bulan, Hutang  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T53 · Dashboard Admin — Ranking Ejen
**Langkah:** Tengok Ranking Ejen dalam Dashboard  
**Jangkaan:** Ejen tersusun, bar % terhadap target_bulanan betul  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T54 · Dashboard Admin — Pending Payment
**Langkah:** Tengok senarai Pending Payment  
**Jangkaan:** Ejen ada hutang tersenarai, jumlah betul  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T55 · Dashboard Admin — Stok Laju / Risiko / Slow
**Langkah:** Scroll ke bahagian analisis stok  
**Jangkaan:** Top 10 stok laju, risiko habis (< 14 hari), slow moving (60+ hari) terpapar  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T56 · Dashboard Warehouse — versi ringkas
**Langkah:** Login sebagai staf WAREHOUSE → buka Dashboard  
**Jangkaan:** KPI kewangan/ranking TIDAK terpapar, hanya info stok & status  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T57 · Ringkasan Bulanan
**Langkah:** Dashboard → Ringkasan Bulanan → pilih bulan  
**Jangkaan:** Jadual jualan/kutipan/belian/write-off terpapar, angka konsisten dengan transaksi  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T58 · VOID retroaktif dalam Ringkasan
**Langkah:** Catat jualan bulan ini → VOID salah satu DO → semak Ringkasan Bulanan semula  
**Jangkaan:** Jualan bulan berkurang (VOID dikecualikan secara automatik)  
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## SENARIO HUJUNG-KE-HUJUNG

### T59 · Kitaran penuh: GRN → DO → Bayar → Pos
```
1. GRN 100 unit SKU-A, kos RM8
2. DO Ejen X, qty 10, harga RM15 (diskaun 5%)
3. Semak picking list
4. Bayar penuh (amaun = jumlah_bersih DO)
5. Tambah postage J&T, tracking 123456
6. Semak Hari Ini — strip DO + belum pos
7. Semak Dashboard — KPI nilai stok berkurang, jualan bertambah
```
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T60 · Kitaran penuh: Transfer → Jualan Outlet → Return
```
1. Transfer 30 unit SKU-A dari WH ke Outlet-1
2. Jualan Outlet-1, qty 5, harga outlet
3. Return 2 unit dari Outlet-1, disposisi RESTOCK
4. Semak: WH baki betul, Outlet baki betul, LEDGER konsisten
```
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T61 · Kitaran penuh: Return Rosak → Lupus → Integriti
```
1. Return RTN_EJEN qty 3, disposisi ROSAK
2. Lupus 2 unit dari ROSAK
3. Semak baki ROSAK = 1
4. Semak Integriti → mesti HIJAU
```
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

### T62 · VOID chain: DO ada return, void return dulu baru void DO
```
1. DO Ejen Y, qty 5
2. Return 1 unit dari Ejen Y (KREDIT_RETURN auto-jana)
3. Cuba VOID DO → patut disekat (ada return)
4. VOID Return dulu → KREDIT_RETURN auto-void
5. VOID DO → berjaya
6. Semak baki WH pulih penuh
```
**Hasil:** [ ] ✅  [ ] ❌ `_____________________`

---

## SEMAK AKHIR GO-LIVE

```
[ ] Semua T01–T62 lulus (atau noted dengan workaround yang boleh diterima)
[ ] PIN admin ditukar dari 123456
[ ] backup_folder_id diisi dalam Tetapan
[ ] admin_email diisi dalam Tetapan
[ ] setupTriggers() telah dijalankan
[ ] Trigger aktif disahkan (Apps Script → Triggers — patut ada 3 trigger)
[ ] Harga outlet/runcit semua produk diisi (bukan 0)
[ ] min_stok_wh semua produk ditetapkan
[ ] Seed data dipadam / data sebenar dimasukkan
[ ] URL app dikongsi dengan Puan Olin + staf
```

---

**Jumlah test case:** 64 + 10 semak go-live  
**Rujuk:** [FLOWCHART.md](FLOWCHART.md) untuk carta alir visual setiap senario

---

## LOG TROUBLESHOOT (rekod isu lepas UAT awal)

| Tarikh | Isu | Fix | Status |
|---|---|---|---|
| 2026-06-12 | `backup_folder_id`, `admin_email`, `backup_simpan_hari`, `void_warehouse_hari_sama` tiada dalam UI Tetapan | Tambah ke `LABELS` dalam `renderMasterTetapan` (index.html) | ✅ fixed |
| 2026-06-12 | `sesi_tamat_jam`, `nilai_minimum_diskaun_lulus_admin` terpapar dalam UI tapi nilai kosong (tidak dalam `PUBLIC_SETTINGS`) | Tambah kedua key ke `PUBLIC_SETTINGS` dalam `getMaster` (Code.gs) | ✅ fixed |
| 2026-06-12 | Backup harian — salah faham: dikira akan padam semua fail dalam folder | Disahkan: `backupHarian` ada regex `/^OlinV2-backup-(\d{4}-\d{2}-\d{2})$/` — hanya padam fail OlinV2 sahaja, selamat | ✅ tiada bug |
