// ==========================================================================
// SISTEM INVENTORI KEDAI OLIN — Google Apps Script Backend
// --------------------------------------------------------------------------
// Sheet = database mentah. GAS buat SEMUA pengiraan (bukan formula Sheet).
// Front-end HTML panggil API ni via helper callGAS (GET untuk baca, POST
// text/plain untuk tulis — elak CORS preflight).
//
// Math chain direplika TEPAT dari workbook Excel asal:
//   harga_tetap  = harga_jualan x kuantiti
//   diskaun      = SIMPAN NEGATIF
//   harga_akhir  = harga_tetap + diskaun
//   kos_barang   = kos_seunit x kuantiti
//   untung_kasar = harga_akhir - (kos_barang + postage + packaging)
//   baki stok    = stok_masuk - jualan   (JENIS=SERVIS => baki 0)
//   nilai_stok   = baki x kos_seunit
// ==========================================================================

var TZ = "Asia/Kuala_Lumpur";
var BULAN = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// ==========================================================================
// Keep Warm — Triggers > keepWarm > Time-driven > Every 5 minutes
// Elak cold-start GAS supaya borang laju.
// ==========================================================================
function keepWarm() { Logger.log("warm"); }

// ==========================================================================
// Init & Penghalaan (Router)
// ==========================================================================
var SS, SHEET_PRODUCTS, SHEET_LOOKUPS, SHEET_SETTINGS, SHEET_SALES, SHEET_PURCHASES, SHEET_EXPENSES;

function _initSheets() {
  if (SS) return;
  SS             = SpreadsheetApp.getActiveSpreadsheet();
  SHEET_PRODUCTS  = SS.getSheetByName("Products");
  SHEET_LOOKUPS   = SS.getSheetByName("Lookups");
  SHEET_SETTINGS  = SS.getSheetByName("Settings");
  SHEET_SALES     = SS.getSheetByName("Sales");
  SHEET_PURCHASES = SS.getSheetByName("Purchases");
  SHEET_EXPENSES  = SS.getSheetByName("Expenses");
}

// Router tunggal dikongsi doGet + doPost.
function _route(body) {
  var action = body.action;
  if      (action === "ping")          return { status: "OK", message: "Olin API running." };
  else if (action === "getMasterData") return getMasterData();
  else if (action === "getStock")      return getStock();
  else if (action === "getDashboard")  return getDashboard();
  else if (action === "login")         return login(body.passcode);
  else if (action === "addSale")       return addSale(body.payload);
  else if (action === "addPurchase")   return addPurchase(body.payload);
  else if (action === "addExpense")    return addExpense(body.payload);
  else return { status: "ERROR", message: "Unknown action: " + action };
}

// Baca: ?data={"action":"...",...}
function doGet(e) {
  _initSheets();
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  var result;
  try {
    if (e.parameter && e.parameter.data) result = _route(JSON.parse(e.parameter.data));
    else result = { status: "OK", message: "Olin API running." };
  } catch (err) {
    result = { status: "ERROR", message: "Router error: " + err.toString() };
  }
  out.setContent(JSON.stringify(result));
  return out;
}

// Tulis: POST Content-Type text/plain, body = JSON string.
function doPost(e) {
  _initSheets();
  var out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  var result;
  try {
    result = _route(JSON.parse(e.postData.contents));
  } catch (err) {
    result = { status: "ERROR", message: "Router error: " + err.toString() };
  }
  out.setContent(JSON.stringify(result));
  return out;
}

// ==========================================================================
// Helpers
// ==========================================================================
function _num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

function _round2(n) { return Math.round(n * 100) / 100; }

// Baca seluruh sheet sebagai array objek guna baris header pertama.
function _readSheet(sheet) {
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(h){ return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    var blank = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = values[i][c];
      if (values[i][c] !== "" && values[i][c] !== null) blank = false;
    }
    if (!blank) rows.push(obj);
  }
  return rows;
}

// Settings sebagai map key->value.
function _settings() {
  var map = {};
  var rows = _readSheet(SHEET_SETTINGS);
  for (var i = 0; i < rows.length; i++) {
    var k = String(rows[i].key || "").trim();
    if (k) map[k] = rows[i].value;
  }
  return map;
}

// ID auto-increment: max(id sedia ada) + 1. Dipanggil DALAM lock.
function _nextId(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < ids.length; i++) {
    var n = parseInt(ids[i][0], 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

// Parse tarikh dari front-end (yyyy-MM-dd) -> Date tengah hari KL (elak shift zon).
function _parseDate(s) {
  if (!s) return new Date();
  var d = new Date(s + "T12:00:00");
  if (isNaN(d.getTime())) return new Date();
  return d;
}

function _monthCode(d) { return BULAN[d.getMonth()]; }

// Index produk by KOD -> { kos_seunit, harga_jualan, nama, jenis }
function _productIndex() {
  var rows = _readSheet(SHEET_PRODUCTS);
  var idx = {};
  for (var i = 0; i < rows.length; i++) {
    var kod = String(rows[i].kod || "").trim().toUpperCase();
    if (!kod) continue;
    idx[kod] = {
      kod: kod,
      nama: String(rows[i].nama || ""),
      jenis: String(rows[i].jenis || "").trim().toUpperCase(),
      kos_seunit: _num(rows[i].kos_seunit),
      harga_jualan: _num(rows[i].harga_jualan)
    };
  }
  return idx;
}

function _cacheBust() {
  try { CacheService.getScriptCache().removeAll(["olin_stock", "olin_dashboard"]); } catch (e) {}
}

// ==========================================================================
// Auth ringkas — passcode owner disimpan dalam Settings (key: passcode)
// ==========================================================================
function login(passcode) {
  var s = _settings();
  var real = String(s.passcode || "").trim();
  if (!real) return { status: "ERROR", message: "Passcode belum diset dalam Settings." };
  if (String(passcode || "").trim() === real) {
    return { status: "SUCCESS", nama: String(s.nama_syarikat || "Kedai Olin") };
  }
  return { status: "ERROR", message: "Passcode salah." };
}

// ==========================================================================
// Master data untuk dropdown borang
// ==========================================================================
function getMasterData() {
  try {
    var products = _readSheet(SHEET_PRODUCTS)
      .filter(function(p){ return String(p.kod || "").trim() && String(p.aktif).toUpperCase() !== "NO"; })
      .map(function(p){
        return {
          kod: String(p.kod).trim().toUpperCase(),
          nama: String(p.nama || ""),
          jenis: String(p.jenis || "").trim().toUpperCase(),
          kos_seunit: _num(p.kos_seunit),
          harga_jualan: _num(p.harga_jualan)
        };
      });

    var lookups = _readSheet(SHEET_LOOKUPS);
    var banks = [], categories = [];
    lookups.sort(function(a,b){ return _num(a.sort_order) - _num(b.sort_order); });
    for (var i = 0; i < lookups.length; i++) {
      var ln = String(lookups[i].list_name || "").trim().toLowerCase();
      var val = String(lookups[i].value || "").trim();
      if (!val) continue;
      if (ln === "bank_cash") banks.push(val);
      else if (ln === "kategori") categories.push(val);
    }

    return { status: "SUCCESS", products: products, banks: banks, categories: categories };
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  }
}

// ==========================================================================
// TULIS — Jualan (1 invois boleh banyak line item)
// payload = { tarikh:"yyyy-MM-dd", melalui:"MAYBANK", staf:"AIN",
//             lines:[ { kod, kuantiti, diskaun } ] }
// diskaun: user masuk nilai positif, kita SIMPAN NEGATIF.
// ==========================================================================
function addSale(payload) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: "ERROR", message: "Sistem sibuk, cuba lagi." }; }
  try {
    if (!payload || !payload.lines || !payload.lines.length)
      return { status: "ERROR", message: "Tiada item jualan." };
    if (!payload.melalui) return { status: "ERROR", message: "Sila pilih bayaran MELALUI." };

    var idx = _productIndex();
    var d = _parseDate(payload.tarikh);
    var stamp = new Date();
    var id = _nextId(SHEET_SALES);
    var newRows = [];
    var totalAkhir = 0, totalUntung = 0;

    for (var i = 0; i < payload.lines.length; i++) {
      var ln = payload.lines[i];
      var kod = String(ln.kod || "").trim().toUpperCase();
      var qty = _num(ln.kuantiti);
      if (!kod) return { status: "ERROR", message: "Baris " + (i+1) + ": KOD kosong." };
      if (!idx[kod]) return { status: "ERROR", message: "Baris " + (i+1) + ": KOD '" + kod + "' tiada dalam Products." };
      if (qty <= 0) return { status: "ERROR", message: "Baris " + (i+1) + ": kuantiti mesti > 0." };

      var p = idx[kod];
      var diskaun = -Math.abs(_num(ln.diskaun));        // simpan negatif
      var harga_tetap = _round2(p.harga_jualan * qty);
      var harga_akhir = _round2(harga_tetap + diskaun);
      var kos_barang  = _round2(p.kos_seunit * qty);
      var untung_kasar = _round2(harga_akhir - kos_barang); // postage/packaging = 0 dalam MVP

      totalAkhir += harga_akhir;
      totalUntung += untung_kasar;

      // Susunan WAJIB ikut header sheet Sales (lihat SETUP.md)
      newRows.push([
        id + i, stamp, d, String(payload.melalui).trim(), kod, p.nama,
        qty, harga_tetap, diskaun, harga_akhir, kos_barang, untung_kasar,
        String(payload.staf || "").trim()
      ]);
    }

    SHEET_SALES.getRange(SHEET_SALES.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    _cacheBust();
    return {
      status: "SUCCESS",
      message: newRows.length + " item jualan disimpan.",
      count: newRows.length,
      total: _round2(totalAkhir),
      untung: _round2(totalUntung)
    };
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================================================
// TULIS — Belian Stok
// payload = { tarikh, melalui, kod, kuantiti, amaun }
// AMOUNT WAJIB (bug Excel asal: kolum amaun kosong).
// ==========================================================================
function addPurchase(payload) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: "ERROR", message: "Sistem sibuk, cuba lagi." }; }
  try {
    if (!payload) return { status: "ERROR", message: "Tiada data." };
    var idx = _productIndex();
    var kod = String(payload.kod || "").trim().toUpperCase();
    var qty = _num(payload.kuantiti);
    var amaun = _num(payload.amaun);
    if (!kod || !idx[kod]) return { status: "ERROR", message: "KOD '" + kod + "' tiada dalam Products." };
    if (qty <= 0) return { status: "ERROR", message: "Kuantiti mesti > 0." };
    if (amaun <= 0) return { status: "ERROR", message: "AMOUNT wajib diisi (> 0)." };

    var d = _parseDate(payload.tarikh);
    var id = _nextId(SHEET_PURCHASES);
    // header: id | timestamp | tarikh | melalui | kod | produk | kuantiti | amaun
    SHEET_PURCHASES.appendRow([ id, new Date(), d, String(payload.melalui||"").trim(), kod, idx[kod].nama, qty, _round2(amaun) ]);
    _cacheBust();
    return { status: "SUCCESS", message: "Belian stok disimpan." };
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================================================
// TULIS — Perbelanjaan
// payload = { tarikh, melalui, butiran, kategori, amaun, catatan }
// ==========================================================================
function addExpense(payload) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: "ERROR", message: "Sistem sibuk, cuba lagi." }; }
  try {
    if (!payload) return { status: "ERROR", message: "Tiada data." };
    var amaun = _num(payload.amaun);
    if (!String(payload.butiran || "").trim()) return { status: "ERROR", message: "Butiran perbelanjaan wajib." };
    if (amaun <= 0) return { status: "ERROR", message: "AMOUNT wajib diisi (> 0)." };

    var d = _parseDate(payload.tarikh);
    var id = _nextId(SHEET_EXPENSES);
    // header: id | timestamp | tarikh | melalui | butiran | kategori | amaun | catatan
    SHEET_EXPENSES.appendRow([
      id, new Date(), d, String(payload.melalui||"").trim(),
      String(payload.butiran).trim(), String(payload.kategori||"").trim(),
      _round2(amaun), String(payload.catatan||"").trim()
    ]);
    _cacheBust();
    return { status: "SUCCESS", message: "Perbelanjaan disimpan." };
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================================================
// BACA — Analisis Stok (dikira on-demand, cache 5 minit)
//   stok_masuk = SUM(Purchases.kuantiti per kod)
//   jualan     = SUM(Sales.kuantiti per kod)
//   baki       = stok_masuk - jualan   (SERVIS => 0)
//   nilai_stok = baki x kos_seunit
// ==========================================================================
function getStock() {
  try {
    var cache = CacheService.getScriptCache();
    var hit = cache.get("olin_stock");
    if (hit) return JSON.parse(hit);

    var products = _readSheet(SHEET_PRODUCTS);
    var sales = _readSheet(SHEET_SALES);
    var purchases = _readSheet(SHEET_PURCHASES);

    var masuk = {}, keluar = {};
    for (var i = 0; i < purchases.length; i++) {
      var k = String(purchases[i].kod || "").trim().toUpperCase();
      masuk[k] = (masuk[k] || 0) + _num(purchases[i].kuantiti);
    }
    for (var j = 0; j < sales.length; j++) {
      var ks = String(sales[j].kod || "").trim().toUpperCase();
      keluar[ks] = (keluar[ks] || 0) + _num(sales[j].kuantiti);
    }

    var rows = [], totalNilai = 0;
    for (var p = 0; p < products.length; p++) {
      var kod = String(products[p].kod || "").trim().toUpperCase();
      if (!kod) continue;
      var jenis = String(products[p].jenis || "").trim().toUpperCase();
      var kos = _num(products[p].kos_seunit);
      var sm = masuk[kod] || 0;
      var jl = keluar[kod] || 0;
      var isServis = (jenis === "SERVIS");
      var baki = isServis ? 0 : (sm - jl);
      var nilai = _round2(baki * kos);
      totalNilai += nilai;
      rows.push({
        kod: kod, nama: String(products[p].nama || ""), jenis: jenis,
        stok_masuk: sm, jualan: jl, baki: baki, nilai_stok: nilai, is_servis: isServis
      });
    }

    var result = { status: "SUCCESS", rows: rows, totalNilai: _round2(totalNilai) };
    cache.put("olin_stock", JSON.stringify(result), 300);
    return result;
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  }
}

// ==========================================================================
// BACA — Dashboard (cache 5 minit). Period dikira ikut zon KL.
// ==========================================================================
function getDashboard() {
  try {
    var cache = CacheService.getScriptCache();
    var hit = cache.get("olin_dashboard");
    if (hit) return JSON.parse(hit);

    var now = new Date();
    var todayStr = Utilities.formatDate(now, TZ, "yyyy-MM-dd");
    var ym = Utilities.formatDate(now, TZ, "yyyy-MM");
    var year = Utilities.formatDate(now, TZ, "yyyy");

    var sales = _readSheet(SHEET_SALES);
    var expenses = _readSheet(SHEET_EXPENSES);

    var jualanHari = 0, jualanBulan = 0, jualanTahun = 0;
    var untungBulan = 0, untungTahun = 0;
    for (var i = 0; i < sales.length; i++) {
      var d = sales[i].tarikh instanceof Date ? sales[i].tarikh : _parseDate(String(sales[i].tarikh));
      var ds = Utilities.formatDate(d, TZ, "yyyy-MM-dd");
      var akhir = _num(sales[i].harga_akhir);
      var unt = _num(sales[i].untung_kasar);
      if (ds.substring(0,4) === year) { jualanTahun += akhir; untungTahun += unt; }
      if (ds.substring(0,7) === ym)   { jualanBulan += akhir; untungBulan += unt; }
      if (ds === todayStr)            { jualanHari  += akhir; }
    }

    var belanjaBulan = 0, belanjaTahun = 0;
    for (var e = 0; e < expenses.length; e++) {
      var de = expenses[e].tarikh instanceof Date ? expenses[e].tarikh : _parseDate(String(expenses[e].tarikh));
      var des = Utilities.formatDate(de, TZ, "yyyy-MM-dd");
      var amt = _num(expenses[e].amaun);
      if (des.substring(0,4) === year) belanjaTahun += amt;
      if (des.substring(0,7) === ym)   belanjaBulan += amt;
    }

    var stock = getStock();
    var result = {
      status: "SUCCESS",
      jualan_hari: _round2(jualanHari),
      jualan_bulan: _round2(jualanBulan),
      jualan_tahun: _round2(jualanTahun),
      untung_bersih_bulan: _round2(untungBulan - belanjaBulan),
      untung_bersih_tahun: _round2(untungTahun - belanjaTahun),
      belanja_bulan: _round2(belanjaBulan),
      belanja_tahun: _round2(belanjaTahun),
      nilai_stok: stock.status === "SUCCESS" ? stock.totalNilai : 0,
      tarikh: Utilities.formatDate(now, TZ, "dd/MM/yyyy")
    };
    cache.put("olin_dashboard", JSON.stringify(result), 300);
    return result;
  } catch (e) {
    return { status: "ERROR", message: e.toString() };
  }
}

// ==========================================================================
// SETUP — jalankan SEKALI dari editor (Run > setupOlinSheets) untuk cipta
// semua sheet + header + seed contoh. Selamat dijalankan berulang (idempotent).
// ==========================================================================
function setupOlinSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var schema = {
    "Products":  ["kod","jenis","nama","kos_seunit","harga_jualan","aktif"],
    "Lookups":   ["list_name","value","sort_order"],
    "Settings":  ["key","value"],
    "Sales":     ["id","timestamp","tarikh","melalui","kod","produk","kuantiti","harga_tetap","diskaun","harga_akhir","kos_barang","untung_kasar","staf"],
    "Purchases": ["id","timestamp","tarikh","melalui","kod","produk","kuantiti","amaun"],
    "Expenses":  ["id","timestamp","tarikh","melalui","butiran","kategori","amaun","catatan"]
  };

  Object.keys(schema).forEach(function(name){
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(schema[name]);
      sh.getRange(1, 1, 1, schema[name].length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });

  // Seed Settings (hanya jika kosong)
  var setSh = ss.getSheetByName("Settings");
  if (setSh.getLastRow() < 2) {
    setSh.getRange(2,1,6,2).setValues([
      ["nama_syarikat","KEDAI OLIN"],
      ["passcode","olin123"],
      ["invoice_prefix","OBSB"],
      ["invoice_seq","154"],
      ["zakat_rate","0.025"],
      ["timezone","Asia/Kuala_Lumpur"]
    ]);
  }

  // Seed Lookups (hanya jika kosong)
  var lkSh = ss.getSheetByName("Lookups");
  if (lkSh.getLastRow() < 2) {
    lkSh.getRange(2,1,8,3).setValues([
      ["bank_cash","MAYBANK",1],
      ["bank_cash","CIMB",2],
      ["bank_cash","CASH",3],
      ["kategori","Bahan Mentah",1],
      ["kategori","Gaji dan Upah",2],
      ["kategori","Sewa/Pajakan",3],
      ["kategori","Komisen",4],
      ["kategori","Utiliti",5]
    ]);
  }

  SpreadsheetApp.getUi().alert("✅ Setup selesai. Isikan sheet Products dengan senarai produk dari MASTERLIST, kemudian deploy Web App.");
}
