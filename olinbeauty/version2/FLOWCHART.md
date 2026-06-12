# Olin Beauty Inventori V2 — Carta Alir Sistem

Versi: `olin-v2-M6-2026.06.12` | Render dengan [Mermaid Live](https://mermaid.live)

---

## 1. Gambaran Keseluruhan Sistem

```mermaid
graph TD
    subgraph INPUT["INPUT — Stok Masuk"]
        GRN["GRN\nStok Masuk\n(Pembekal → WH)"]
    end

    subgraph STOK["STOK (LEDGER + BATCH)"]
        WH["WAREHOUSE\nStok Semasa"]
        ROSAK["ROSAK\nKuarantin"]
        OUT["OUTLET(s)\nStok Konsain"]
    end

    subgraph KELUAR["KELUAR — Transaksi"]
        DO["DO Ejen\n(WH → Ejen)"]
        TRF["Transfer\n(WH → Outlet)"]
        JLO["Jualan Outlet\n(Outlet → Pelanggan)"]
        RTN["Return\n(Ejen/Outlet → WH/ROSAK)"]
        LUPUS["Lupus\n(ROSAK → Buang)"]
    end

    subgraph BAYAR["BAYARAN"]
        PAY["Bayaran Ejen\n(TUNAI/TRANSFER/KREDIT)"]
        POS["Pos\n(CityLink/J&T)"]
    end

    subgraph ADMIN["ADMIN & KAWALAN"]
        VOID["VOID Dokumen\n(reversal baki)"]
        KIRAAN["Kiraan Stok\n(Blind Count)"]
        INTEGRITI["Semak Integriti\n(I1–I9)"]
        BACKUP["Backup Harian\n(Drive)"]
    end

    subgraph LAPORAN["LAPORAN"]
        DASH["Dashboard\n(KPI + Ranking)"]
        LEDGER["Ledger Audit\n(Semua transaksi)"]
        RING["Ringkasan Bulanan"]
    end

    GRN --> WH
    WH --> DO
    WH --> TRF
    TRF --> OUT
    OUT --> JLO
    DO --> PAY
    DO --> POS
    RTN --> WH
    RTN --> ROSAK
    ROSAK --> LUPUS
    VOID -.->|reversal| WH
    KIRAAN -->|ADJ/GRN auto| WH
    WH --> INTEGRITI
    INTEGRITI --> BACKUP
    WH --> DASH
    DO --> DASH
    PAY --> DASH
    DASH --> RING
    LEDGER --> INTEGRITI
```

---

## 2. Aliran Stok Masuk (GRN)

```mermaid
flowchart TD
    A([Admin/Staf WH]) --> B["Isi form:\nSKU · Kuantiti · Kos\nExpiry · Batch"]
    B --> C{Batch ada expiry?}
    C -->|Ya| D["Tetapkan tarikh\nexpiry"]
    C -->|Tidak| E["Tandakan\nada_expiry=NO"]
    D & E --> F["GAS: _allocateFIFO\n→ cipta BATCH baru\n→ DOC_HEADER + DOC_LINES\n→ LEDGER MASUK\n(safe write order)"]
    F --> G["Baki WH bertambah\nstatus: AKTIF"]
    G --> H([Notis Stok dikemaskini])
```

---

## 3. Aliran DO Ejen (Delivery Order)

```mermaid
flowchart TD
    A([Staf/Admin]) --> B["previewDO:\nPilih Ejen · SKU · Qty\nDiskaun · Catatan"]
    B --> C["GAS: _computeDO\n(sen-integer)\n_allocateFIFO FEFO\n→ semak baki WH"]
    C --> D{Baki mencukupi?}
    D -->|Tidak| E([ERROR: Baki tidak cukup])
    D -->|Ya| F{Ada expiry\nbetween 0–60 hari?}
    F -->|Ya| G["Papar amaran\nCONFIRM_EXPIRY\n→ staf kena sahkan"]
    F -->|Tidak| H
    G -->|Sahkan| H["addDOEjen:\nDOC_HEADER + DOC_LINES\nLEDGER KELUAR\nBatch dikurangkan"]
    H --> I["Status: AKTIF\nPicking list + WhatsApp\ncopy tersedia"]
    I --> J{Tambah postage?}
    J -->|Ya| K["addPostage:\nKurier · Tracking · Berat"]
    J -->|Tidak| L([Siap])
    K --> L
```

---

## 4. Aliran Bayaran Ejen

```mermaid
flowchart TD
    A([Admin]) --> B["addPayment:\nEjen · Amaun · Kaedah\n(TUNAI/TRANSFER/KREDIT)"]
    B --> C["GAS: agih kepada\nDO tertunggak\n(tertua dulu)"]
    C --> D{Lebihan selepas\nagih semua DO?}
    D -->|Ya| E["Lebihan → KREDIT\n(baki_kredit_rm)"]
    D -->|Tidak| F["DO diliputi fully\njumlah_dibayar = bersih"]
    E & F --> G["Rekod PAYMENTS\nstatus bayaran DO\nDERIVED via _payAgg"]
    G --> H([Hutang ejen dikemas])
```

---

## 5. Aliran Transfer (WH → Outlet)

```mermaid
flowchart TD
    A([Admin]) --> B["addTransfer:\nPilih Outlet · SKU · Qty\n(dari batch WH)"]
    B --> C["GAS: _allocateFIFO FEFO\n→ semak baki WH"]
    C --> D{Baki WH mencukupi?}
    D -->|Tidak| E([ERROR])
    D -->|Ya| F["DOC_HEADER + DOC_LINES\nLEDGER KELUAR (WH)\nLEDGER MASUK (Outlet)\nbatch_id GLOBAL dikongsi\n(safe write order)"]
    F --> G["Stok WH berkurang\nStok Outlet bertambah"]
```

---

## 6. Aliran Jualan Outlet

```mermaid
flowchart TD
    A([Staf Outlet/Admin]) --> B["addJualanOutlet:\nPilih Outlet · SKU · Qty\nHarga outlet/runcit"]
    B --> C["GAS: _allocateOrder FEFO\n(priceMode: OUTLET)\nsemak baki Outlet"]
    C --> D{Baki Outlet cukup?}
    D -->|Tidak| E([ERROR])
    D -->|Ya| F["DOC_HEADER + DOC_LINES\nLEDGER KELUAR (Outlet)\nStatus: LUNAS\n(tiada bayaran — bayar tunai terus)"]
    F --> G["Jualan dicatat\nKutipan bulan bertambah"]
```

---

## 7. Aliran Return

```mermaid
flowchart TD
    A([Admin]) --> B["addReturn:\nJenis: RTN_EJEN / RTN_OUTLET\nSKU · Qty · Disposisi"]
    B --> C{Jenis Return?}
    C -->|RTN_EJEN| D["MASUK sahaja\n→ RESTOCK: LEDGER MASUK WH\n→ ROSAK: LEDGER MASUK ROSAK"]
    C -->|RTN_OUTLET| E["Pasangan:\nLEDGER KELUAR (Outlet)\nLEDGER MASUK (WH/ROSAK)"]
    D & E --> F{Disposisi?}
    F -->|RESTOCK| G["Barang balik ke WH\nBatch asal dipulihkan"]
    F -->|ROSAK| H["Barang ke ROSAK\nKuarantin"]
    G & H --> I["RTN_EJEN → jana KREDIT_RETURN\nautomatik potong hutang ejen"]
```

---

## 8. Aliran VOID Dokumen

```mermaid
flowchart TD
    A([Admin / Staf WH*]) --> B["Buka Dokumen\n#/dokumen → pilih doc"]
    B --> C["GAS: _voidPreCheck\n→ semak syarat void\n→ simulasi reversal baki"]
    C --> D{Boleh void?}
    D -->|Tidak| E(["ERROR:\nsebab disekat\n(berbayar / baki negatif /\nbukan hari sama*)"])
    D -->|Ya| F["Header → VOIDING\n(transient, selamat)"]
    F --> G["Append baris reversal\n(is_reversal=YES, qty bertanda balik)\n→ flush()"]
    G --> H["Header → VOID\ncatat sebab + void_by"]
    H --> I{RTN_EJEN?}
    I -->|Ya| J["Auto-void KREDIT_RETURN\ndalam lock yang sama"]
    I -->|Tidak| K([Selesai])
    J --> K

    note1["*Staf WH boleh void:\ndoc sendiri + hari sama\n+ tiada bayaran\n+ toggle void_warehouse_hari_sama=YES"]
```

---

## 9. Aliran Kiraan Stok (Blind Count)

```mermaid
flowchart TD
    A([Admin]) --> B["createStockCount:\nPilih Lokasi\nanchor = lastRow LEDGER"]
    B --> C([Staf WH])
    C --> D["saveStockCount:\nIsi qty FIZIKAL\n(tiada lihat qty sistem)\nBoleh tambah 'batch ditemui'"]
    D --> E{Status SC}
    E -->|DRAF| D
    E -->|SUBMIT| F([Admin])
    F --> G["GAS: getStockCount\npapar varians (Admin sahaja)"]
    G --> H{Keputusan Admin}
    H -->|Tolak| I["rejectStockCount\nSC → DITOLAK\ncatatan sebab"]
    H -->|Lulus| J["GAS: stale check\n(ada gerakan LEDGER\nsejak anchor?)"]
    J --> K{Stale?}
    K -->|Ya| L(["ERROR: Kiraan basi\nulang semula"])
    K -->|Tidak| M["Jana dokumen auto:\n→ ADJ (varians qty bertanda)\n→ GRN PENEMUAN (batch baharu)\nLEDGER TERAKHIR\nSC → DILULUSKAN"]
```

---

## 10. Aliran Integriti & Backup (Automatik)

```mermaid
flowchart TD
    subgraph CFG["Tetapan Wajib (Master → Tetapan)"]
        S1["admin_email\n(e-mel notifikasi)"]
        S2["backup_folder_id\n(ID folder Google Drive)\nKosong = simpan di root"]
        S3["backup_simpan_hari\n(lalai: 30)"]
        S4["void_warehouse_hari_sama\n(YES/NO — toggle staf WH)"]
    end

    subgraph TRIGGER["Trigger Harian (Auto — run setupTriggers() sekali)"]
        T1["keepWarm\n(setiap 5 min)\nElak cold start"] 
        T2["backupHarian\n(1 pagi)\nSalin Sheet → folder Drive\nPadam OlinV2-backup-* > N hari\n⚠️ HANYA fail OlinV2-backup-*\nbukan semua fail dalam folder"]
        T3["semakIntegritiHarian\n(6 pagi)\n_runIntegriti I1-I9"]
    end

    S2 --> T2
    S3 --> T2
    S1 --> T3

    T3 --> A{Ada I1–I9\nGAGAL?}
    A -->|Tiada masalah| B["Properties: HIJAU\nLencana hijau di app"]
    A -->|Ada masalah| C["Properties: MERAH\nLencana merah di app"]
    C --> D{Kritikal?}
    D -->|Ya| E["MailApp.sendEmail\n→ admin_email\n(jika kosong: e-mel akaun deploy)"]
    D -->|Tidak| F["Log AUDIT_LOG sahaja\ntiada e-mel"]

    subgraph INVARIANT["9 Invariant (I1–I9)"]
        I1["I1: Baki ≥ 0\n(tiada stok negatif)"]
        I2["I2: Orphan LEDGER\n(tiada DOC_HEADER)"]
        I3["I3: Lines ↔ LEDGER\n(ADJ: masuk+keluar;\nlain: max)"]
        I4["I4: VOIDING tergantung\n(patut jadi VOID)"]
        I5["I5: TRF Σ = 0\n(KELUAR WH = MASUK Outlet)"]
        I6["I6: Dibayar ≤ Bersih\n(tiada lebih bayar)"]
        I7["I7: No unik + counter\n≥ max doc seq"]
        I8["I8: Snapshot aktif\n(jika dikonfigur)"]
        I9["I9: Checksum baris LEDGER\n+ KREDIT_RETURN sumber VOID"]
    end
```

---

## 11. Aliran Log Masuk & Hak Akses

```mermaid
flowchart TD
    A([Pengguna buka app]) --> B["Skrin Log Masuk:\nID Staf + PIN"]
    B --> C["GAS: _auth\nperiksa pin_hash bcrypt-style"]
    C --> D{Sah?}
    D -->|Tidak| E([Tolak: ID/PIN salah])
    D -->|Ya| F["Jana sesi:\nsession_token → Properties\ncache 4 jam"]
    F --> G{Role?}
    G -->|ADMIN| H["Akses PENUH:\nDashboard KPI\nRingkasan Bulanan\nSemak Integriti\nVOID mana-mana\nKiraan: Lulus/Tolak\nLedger penuh"]
    G -->|WAREHOUSE| I["Akses TERHAD:\nHari Ini (ringkas)\nStok Masuk (GRN)\nDO Ejen + Pos\nTransfer\nVOID doc sendiri*\nKiraan: Isi sahaja"]
    G -->|OUTLET| J["Akses OUTLET:\nJualan Outlet\nReturn dari outlet\nStok outlet sendiri"]

    note1["*bersyarat: void_warehouse_hari_sama=YES\n+ doc sendiri + hari sama + tiada bayaran"]
```

---

## 12. Ringkasan Bulanan (Recompute-on-Read)

```mermaid
flowchart TD
    A([Admin pilih bulan]) --> B["getRingkasanBulanan\n(bulan/tahun)"]
    B --> C["Scan SEMUA LEDGER\n+ DOC_HEADER\n(tapis status AKTIF sahaja\n— VOID dikecualikan)"]
    C --> D["Kira per bulan:\n→ Jualan Ejen (DO−RTN)\n→ Jualan Outlet (JLO)\n→ Kutipan (PAYMENTS + JLO)\n→ Belian Stok (GRN kos)\n→ Write-off (LUPUS/ADJ negatif)\n→ Stok akhir bulan"]
    D --> E["Papar jadual 12 bulan\n(bulan semasa paling kiri)"]
    E --> F["NOTA: VOID retroaktif\nkurangkan bulan asal\nautomatik"]
```

---

## Glosari Cepat

| Istilah | Maksud |
|---|---|
| LEDGER | Semua pergerakan stok (append-only, TIDAK boleh edit) |
| BATCH | Lot stok fizikal (expiry + kos seunit) |
| FEFO | First-Expired-First-Out — keluar yang expiry awal dulu |
| VOID | Batalkan dokumen → jana baris reversal dalam LEDGER |
| VOIDING | Status sementara semasa proses void (elak double-void) |
| ROSAK | Lokasi kuarantin stok rosak/returned |
| ADJ | Adjustment — varians kiraan stok, qty bertanda (+/−) |
| GRN | Goods Received Note — stok masuk dari pembekal |
| DO | Delivery Order — hantar stok ke ejen |
| JLO | Jualan Langsung Outlet |
| TRF | Transfer WH → Outlet |
| RTN | Return dari ejen/outlet |
| KREDIT_RETURN | Kredit auto-jana dari RTN_EJEN untuk potong hutang |
| sc_status | Status kiraan stok (DRAF/SUBMIT/DILULUSKAN/DITOLAK) |
| _ok envelope | `{status:'SUCCESS', ...payload}` — status ditetap TERAKHIR |
| SEN integer | Wang dikira dalam sen (×100) elak floating-point ralat |
