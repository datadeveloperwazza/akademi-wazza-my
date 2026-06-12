/**
 * OLIN BEAUTY INVENTORY V2 — Google Apps Script backend
 * Milestone M0: tulang belakang (setup + router + auth + helper teras).
 * Rujuk: olin-inventory/DESIGN-V2.md
 *
 * Konvensyen:
 *  - Sheet = raw data store. SEMUA kiraan dalam GAS (tiada formula sheet).
 *  - Baca  : GET  ?data=<JSON>      (action di body)
 *  - Tulis : POST text/plain body JSON
 *  - Respons sentiasa HTTP 200: {status:'SUCCESS'|'ERROR', code?, message?, ...}
 *  - Wang dalam SEN integer semasa kira (P5). Tarikh string yyyy-MM-dd KL.
 */

var VERSI = 'olin-v2-M6b-2026.06.12';

// ===================== NAMA SHEET =====================
var SHEETS = {
  LEDGER:    'LEDGER',
  DOC_HEADER:'DOC_HEADER',
  DOC_LINES: 'DOC_LINES',
  BATCH:     'BATCH',
  PAYMENTS:  'PAYMENTS',
  PRODUK:    'MASTER_PRODUK',
  EJEN:      'MASTER_EJEN',
  OUTLET:    'MASTER_OUTLET',
  STAFF:     'MASTER_STAFF',
  SETTINGS:  'SETTINGS',
  AUDIT:     'AUDIT_LOG',
  SNAPSHOT:  'SNAPSHOT_STOK',
  POSTAGE:   'POSTAGE_LOG',
  STOCK_COUNT:'STOCK_COUNT',
  ANNOUNCE:  'ANNOUNCEMENTS',
  POINTS:    'POINTS_LEDGER'
};

// ===================== SKEMA (kolum setiap sheet) =====================
var SCHEMA = {};
SCHEMA[SHEETS.LEDGER]     = ['ledger_id','created_at','tarikh_efektif','doc_no','doc_type','sku','batch_id','arah','qty','lokasi','kos_seunit_rm','pihak','is_reversal','reversal_of','created_by'];
SCHEMA[SHEETS.DOC_HEADER] = ['doc_id','doc_no','doc_type','subjenis','tarikh','pihak_jenis','pihak_id','lokasi_sasaran','subtotal_rm','diskaun_jenis','diskaun_input','diskaun_rm','postage_rm','jumlah_bersih_rm','kurier','no_tracking','berat_kg','rujukan_order_web','status','void_reason','void_by','void_at','catatan','client_ref','created_by','created_at'];
SCHEMA[SHEETS.DOC_LINES]  = ['line_id','doc_id','doc_no','sku','nama_produk','qty','harga_seunit_rm','jumlah_rm','disposisi','batch_id_rujukan','catatan_line'];
SCHEMA[SHEETS.BATCH]      = ['batch_id','sku','batch_no','expiry','ada_expiry','kos_seunit_rm','kos_anggaran','lokasi_rak','grn_doc_no','tarikh_terima','created_by','created_at'];
SCHEMA[SHEETS.PAYMENTS]   = ['pay_no','tarikh','ejen_id','doc_no','kaedah','amaun_rm','rujukan_resit','sumber_doc','status','void_reason','void_by','void_at','catatan','client_ref','created_by','created_at'];
SCHEMA[SHEETS.PRODUK]     = ['sku','nama','kategori','jenis_item','ada_expiry','kos_rujukan_rm','harga_ejen_rm','harga_outlet_rm','harga_runcit_rm','berat_gram','min_stok_wh','aktif','updated_by','updated_at'];
SCHEMA[SHEETS.EJEN]       = ['ejen_id','nama','no_tel','kawasan','target_bulanan_rm','aktif','pin_portal_salt','pin_portal_hash','updated_by','updated_at'];
SCHEMA[SHEETS.OUTLET]     = ['outlet_id','nama','alamat','no_tel','aktif','pin_portal_salt','pin_portal_hash','updated_by','updated_at'];
SCHEMA[SHEETS.STAFF]      = ['staff_id','nama','no_tel','role','outlet_id','pin_salt','pin_hash','aktif','updated_by','updated_at'];
SCHEMA[SHEETS.SETTINGS]   = ['key','value'];
SCHEMA[SHEETS.AUDIT]      = ['log_id','created_at','staff_id','action','ref','detail'];
SCHEMA[SHEETS.SNAPSHOT]   = ['snapshot_id','tarikh','anchor_row','sku','lokasi','batch_id','baki_qty','kos_seunit_rm'];
SCHEMA[SHEETS.POSTAGE]    = ['pos_id','do_no','kurier','no_tracking','berat_kg','cas_kos_rm','created_by','created_at'];
SCHEMA[SHEETS.STOCK_COUNT]= ['sc_no','status','lokasi','anchor_row','tarikh','sku','batch_id','batch_no_ditemui','expiry_ditemui','qty_sistem','qty_fizikal','varians','adj_doc_no','created_by','created_at','processed_by','processed_at'];
SCHEMA[SHEETS.ANNOUNCE]   = ['ann_id','tarikh_mula','tarikh_tamat','tajuk','isi','sasaran','status','created_by','created_at'];
SCHEMA[SHEETS.POINTS]     = ['point_id','tarikh','ejen_id','jenis','point','reversal_of','rujukan_program','created_by','created_at'];

// Kolum yang MESTI text (elak GAS auto-convert tarikh/nombor) — gotcha wazza.
var TEXT_HEADERS = {
  tarikh:1, tarikh_efektif:1, expiry:1, tarikh_terima:1, tarikh_mula:1, tarikh_tamat:1,
  expiry_ditemui:1, created_at:1, updated_at:1, void_at:1, processed_at:1,
  batch_no:1, batch_no_ditemui:1, no_tracking:1, no_tel:1,
  pin_hash:1, pin_salt:1, pin_portal_hash:1, pin_portal_salt:1,
  client_ref:1, rujukan_resit:1, rujukan_order_web:1, value:1
};

// ===================== ENTRY POINTS =====================
function doGet(e) {
  var body = {};
  try { if (e && e.parameter && e.parameter.data) body = JSON.parse(e.parameter.data); }
  catch (err) { return _content(_err('Permintaan tidak sah (JSON).')); }
  if (!body.action) return _content({ status: 'OK', message: 'Olin Beauty API v2 (' + VERSI + ') running.' });
  return _content(_route(body));
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return _content(_err('Permintaan tidak sah (JSON).')); }
  return _content(_route(body));
}

function _content(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===================== ROUTER =====================
// role: 'PUBLIC' (tiada auth) | 'ANY' (token sah) | 'ADMIN' (admin sahaja)
var ACTIONS = {
  ping:            { role: 'PUBLIC', fn: a_ping },
  login:           { role: 'PUBLIC', fn: a_login },
  logout:          { role: 'ANY',    fn: a_logout },
  getBootstrap:    { role: 'ANY',    fn: a_getBootstrap },
  // M1
  getStock:        { role: 'ANY',   fn: a_getStock },
  getExpiryAlerts: { role: 'ANY',   fn: a_getExpiryAlerts },
  upsertProduk:    { role: 'ADMIN', fn: a_upsertProduk },
  upsertEjen:      { role: 'ADMIN', fn: a_upsertEjen },
  upsertOutlet:    { role: 'ADMIN', fn: a_upsertOutlet },
  upsertStaff:     { role: 'ADMIN', fn: a_upsertStaff },
  getStaffList:    { role: 'ADMIN', fn: a_getStaffList },
  saveSettings:    { role: 'ADMIN', fn: a_saveSettings },
  // M2
  addGRN:          { role: 'ANY',   fn: a_addGRN },
  // M3
  previewDO:       { role: 'ANY',   fn: a_previewDO },
  addDOEjen:       { role: 'ANY',   fn: a_addDOEjen },
  // M4a
  getAkaunRingkasan: { role: 'ANY',   fn: a_getAkaunRingkasan },
  getStatementEjen:  { role: 'ANY',   fn: a_getStatementEjen },
  addPayment:        { role: 'ANY',   fn: a_addPayment },
  voidPayment:       { role: 'ADMIN', fn: a_voidPayment },
  // M4b
  addTransfer:       { role: 'ANY',   fn: a_addTransfer },
  addJualanOutlet:   { role: 'ANY',   fn: a_addJualanOutlet },
  addReturn:         { role: 'ANY',   fn: a_addReturn },
  addLupus:          { role: 'ADMIN', fn: a_addLupus },
  addPostage:        { role: 'ANY',   fn: a_addPostage },
  getPosHariIni:     { role: 'ANY',   fn: a_getPosHariIni },
  getBatches:        { role: 'ANY',   fn: a_getBatches },
  // M5
  getDocList:        { role: 'ANY',   fn: a_getDocList },
  getDocDetail:      { role: 'ANY',   fn: a_getDocDetail },
  voidDoc:           { role: 'ANY',   fn: a_voidDoc },   // WH bersyarat — semakan dalam fungsi
  semakIntegriti:    { role: 'ADMIN', fn: a_semakIntegriti },
  getAnomali:        { role: 'ANY',   fn: a_getAnomali },
  createStockCount:  { role: 'ANY',   fn: a_createStockCount },
  saveStockCount:    { role: 'ANY',   fn: a_saveStockCount },
  getStockCount:     { role: 'ANY',   fn: a_getStockCount },
  approveStockCount: { role: 'ADMIN', fn: a_approveStockCount },
  rejectStockCount:  { role: 'ADMIN', fn: a_rejectStockCount },
  getLedger:         { role: 'ADMIN', fn: a_getLedger },
  rebuildCounters:   { role: 'ADMIN', fn: a_rebuildCounters },
  // M6
  getDashboard:        { role: 'ANY',   fn: a_getDashboard },   // ditapis ikut role DALAM fungsi
  getRingkasanBulanan: { role: 'ADMIN', fn: a_getRingkasanBulanan },
  runBackupNow:        { role: 'ADMIN', fn: a_runBackupNow }
};

function _route(body) {
  try {
    var action = body && body.action;
    if (!action) return _err('Tiada action.');
    var def = ACTIONS[action];
    if (!def) return _err('Action tidak dikenali: ' + action);

    if (def.role === 'PUBLIC') return def.fn(body);

    var sess = _auth(body.token);
    if (!sess) return { status: 'ERROR', code: 'AUTH', message: 'Sesi tamat. Sila log masuk semula.' };
    if (def.role === 'ADMIN' && sess.role !== 'ADMIN') return _err('Tiada kebenaran untuk tindakan ini.');

    body._sess = sess;
    return def.fn(body);
  } catch (err) {
    return _err('Ralat pelayan: ' + err.toString());
  }
}

// ===================== ACTIONS (M0) =====================
function a_ping() {
  return _ok({ versi: VERSI, masa: _nowKL() });
}

function a_login(body) {
  var staffId = String(body.staff_id || '').trim();
  var pin = String(body.pin || '').trim();
  if (!staffId || !pin) return _err('ID atau PIN salah.');

  var cache = CacheService.getScriptCache();
  var rlKey = 'rl_' + staffId;
  var fails = Number(cache.get(rlKey) || 0);
  if (fails >= 5) return _err('Terlalu banyak cubaan. Cuba lagi dalam 15 minit.');

  var staff = _findOne(SHEETS.STAFF, function (s) {
    return String(s.staff_id) === staffId && String(s.aktif).toUpperCase() === 'YES';
  });
  if (!staff) { cache.put(rlKey, String(fails + 1), 900); _audit(staffId, 'login_gagal', staffId, 'staff tak wujud/tak aktif'); return _err('ID atau PIN salah.'); }

  var hash = _sha256(pin + String(staff.pin_salt || ''));
  if (hash !== String(staff.pin_hash)) {
    cache.put(rlKey, String(fails + 1), 900);
    _audit(staffId, 'login_gagal', staffId, 'pin salah');
    return _err('ID atau PIN salah.');
  }
  cache.remove(rlKey);

  var token = Utilities.getUuid();
  var sess = {
    staff_id: staffId,
    nama: String(staff.nama || ''),
    role: String(staff.role || 'WAREHOUSE').toUpperCase(),
    outlet_id: String(staff.outlet_id || '')
  };
  _saveSession(token, sess);
  return _ok({ token: token, nama: sess.nama, role: sess.role, outlet_id: sess.outlet_id });
}

function a_logout(body) {
  var token = body.token;
  if (token) {
    CacheService.getScriptCache().remove('tok_' + token);
    PropertiesService.getScriptProperties().deleteProperty('tok_' + token);
  }
  return _ok({});
}

function a_getBootstrap(body) {
  var sess = body._sess;
  var produk = _readSheet(SHEETS.PRODUK)
    .filter(function (p) { return String(p.aktif).toUpperCase() === 'YES'; })
    .map(function (p) {
      return {
        sku: p.sku, nama: p.nama, kategori: p.kategori, jenis_item: p.jenis_item,
        ada_expiry: p.ada_expiry, harga_ejen_rm: _num(p.harga_ejen_rm),
        harga_outlet_rm: _num(p.harga_outlet_rm), harga_runcit_rm: _num(p.harga_runcit_rm),
        kos_rujukan_rm: _num(p.kos_rujukan_rm), berat_gram: _num(p.berat_gram), min_stok_wh: _num(p.min_stok_wh)
      };
    });
  var ejen = _readSheet(SHEETS.EJEN)
    .filter(function (e) { return String(e.aktif).toUpperCase() === 'YES'; })
    .map(function (e) { return { ejen_id: e.ejen_id, nama: e.nama, no_tel: e.no_tel, kawasan: e.kawasan, target_bulanan_rm: _num(e.target_bulanan_rm) }; });
  var outlet = _readSheet(SHEETS.OUTLET)
    .filter(function (o) { return String(o.aktif).toUpperCase() === 'YES'; })
    .map(function (o) { return { outlet_id: o.outlet_id, nama: o.nama, alamat: o.alamat }; });

  var PUBLIC_SETTINGS = ['tempoh_alert_expiry_hari', 'tempoh_expiry_kritikal_hari', 'tempoh_slow_moving_hari',
    'tempoh_velocity_hari', 'had_backdate_hari', 'sesi_tamat_jam', 'nilai_minimum_diskaun_lulus_admin',
    'nama_syarikat', 'alamat_syarikat', 'whatsapp_template_do',
    'admin_email', 'backup_folder_id', 'backup_simpan_hari', 'void_warehouse_hari_sama'];
  var settingsPublic = {};
  var allSet = _settingsMap();
  PUBLIC_SETTINGS.forEach(function (k) { settingsPublic[k] = allSet[k]; });

  return _ok({
    produk: produk, ejen: ejen, outlet: outlet, settingsPublic: settingsPublic,
    staf: { staff_id: sess.staff_id, nama: sess.nama, role: sess.role, outlet_id: sess.outlet_id },
    versi: VERSI
  });
}

// ===================== AUTH / SESI =====================
function _sessTtlSec() { return Number(_settingsMap().sesi_tamat_jam || 12) * 3600; }

function _saveSession(token, sess) {
  var ttl = _sessTtlSec();
  var copy = { staff_id: sess.staff_id, nama: sess.nama, role: sess.role, outlet_id: sess.outlet_id };
  CacheService.getScriptCache().put('tok_' + token, JSON.stringify(copy), Math.min(ttl, 21600)); // cache max 6 jam
  copy.exp = Date.now() + ttl * 1000;
  PropertiesService.getScriptProperties().setProperty('tok_' + token, JSON.stringify(copy)); // fallback durable
}

function _auth(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var raw = cache.get('tok_' + token);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  var props = PropertiesService.getScriptProperties();
  var praw = props.getProperty('tok_' + token);
  if (!praw) return null;
  try {
    var sess = JSON.parse(praw);
    if (sess.exp && Date.now() > sess.exp) { props.deleteProperty('tok_' + token); return null; }
    cache.put('tok_' + token, JSON.stringify(sess), 21600); // hidupkan semula cache
    return sess;
  } catch (e) { return null; }
}

// ===================== HELPER: SHEET I/O =====================
function _ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(name) {
  var sh = _ss().getSheetByName(name);
  if (!sh) throw new Error('Sheet tiada: ' + name + ' — jalankan setupOlinSheets().');
  return sh;
}

/** Baca semua baris jadi array objek (key = header). __row = nombor baris sheet. */
function _readSheet(name) {
  var sh = _sheet(name);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var o = { __row: r + 1 };
    for (var c = 0; c < headers.length; c++) o[headers[c]] = values[r][c];
    out.push(o);
  }
  return out;
}

function _findOne(name, predicate) {
  var rows = _readSheet(name);
  for (var i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i];
  return null;
}

/** Tambah baris ikut header sheet (objek key=header). */
function _appendRowsByHeader(name, objs) {
  if (!objs || !objs.length) return;
  var sh = _sheet(name);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = objs.map(function (o) {
    return headers.map(function (h) { return (o[h] === undefined || o[h] === null) ? '' : o[h]; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

// ===================== HELPER: WANG / TARIKH / HASH =====================
function _num(v) { if (v === '' || v === null || v === undefined) return 0; var n = Number(v); return isNaN(n) ? 0 : n; }
function _sen(v) { return Math.round(_num(v) * 100); }
function _rm(sen) { return Math.round(sen) / 100; }

function _nowKL() { return Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss'); }
function _todayKL() { return Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd'); }

function _sha256(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function _uid(prefix) { return (prefix || '') + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }

// ===================== HELPER: SETTINGS / AUDIT =====================
var _settingsMemo = null;
function _settingsMap() {
  if (_settingsMemo) return _settingsMemo;
  _settingsMemo = {};
  _readSheet(SHEETS.SETTINGS).forEach(function (r) { _settingsMemo[r.key] = r.value; });
  return _settingsMemo;
}

function _audit(staffId, action, ref, detail) {
  try {
    _appendRowsByHeader(SHEETS.AUDIT, [{
      log_id: _uid('LOG-'), created_at: _nowKL(), staff_id: staffId || '',
      action: action || '', ref: ref || '',
      detail: (typeof detail === 'string') ? detail : JSON.stringify(detail || {})
    }]);
  } catch (e) { /* audit tak boleh gagalkan operasi */ }
}

// ===================== HELPER: RESPONS =====================
function _ok(obj) { var o = {}; if (obj) for (var k in obj) o[k] = obj[k]; o.status = 'SUCCESS'; return o; } // status LAST: payload tak boleh timpa envelope
function _err(msg, code) { var o = { status: 'ERROR', message: msg }; if (code) o.code = code; return o; }

// ===================== HELPER: LOCK + COUNTER (untuk M2+) =====================
/** Balut tulisan dengan script lock + flush. Guna untuk SEMUA write action stok. */
function _withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return _err('Sistem sibuk, cuba sebentar lagi.');
  try { return fn(); }
  finally { try { SpreadsheetApp.flush(); } catch (e) {} lock.releaseLock(); }
}

/** Nombor dokumen seterusnya (PANGGIL HANYA DALAM LOCK). */
function _nextDocNo(prefix) {
  var FMT = { OBSB: { p: 'OBSB', dash: false, pad: 4, seed: 154 }, GRN: { p: 'GRN', dash: true, pad: 4 },
    TRO: { p: 'TRO', dash: true, pad: 4 }, JLO: { p: 'JLO', dash: true, pad: 4 }, RTN: { p: 'RTN', dash: true, pad: 4 },
    ADJ: { p: 'ADJ', dash: true, pad: 4 }, LPS: { p: 'LPS', dash: true, pad: 4 }, PAY: { p: 'PAY', dash: true, pad: 4 },
    SC: { p: 'SC', dash: true, pad: 4 }, POS: { p: 'POS', dash: true, pad: 4 }, L: { p: 'L', dash: false, pad: 7 } };
  var f = FMT[prefix]; if (!f) throw new Error('Prefix tak dikenali: ' + prefix);
  var props = PropertiesService.getScriptProperties();
  var key = 'seq_' + prefix;
  var n = Number(props.getProperty(key) || f.seed || 0) + 1;
  props.setProperty(key, String(n));
  return f.p + (f.dash ? '-' : '') + String(n).padStart(f.pad, '0');
}

// ===================== SETUP (idempotent) =====================
function setupOlinSheets() {
  var ss = _ss();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    _ensureHeaders(sh, SCHEMA[name]);
    sh.setFrozenRows(1);
    _applyTextFormat(sh, SCHEMA[name]);
    _protectWarn(sh);
  });
  _seedSettings();
  _seedCounters();
  _seedAdmin();
  _seedProduk();
  // buang Sheet1 default kalau kosong & bukan sebahagian skema
  var def = ss.getSheetByName('Sheet1');
  if (def && SCHEMA['Sheet1'] === undefined && ss.getSheets().length > 1 && def.getLastRow() === 0) {
    try { ss.deleteSheet(def); } catch (e) {}
  }
  _settingsMemo = null;
  return 'Setup selesai: ' + Object.keys(SCHEMA).length + ' tab, 50 produk seed. Admin: STF-01 / PIN 123456 (TUKAR SEGERA).';
}

function _ensureHeaders(sh, headers) {
  var lastCol = sh.getLastColumn();
  var existing = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var kosong = existing.length === 0 || existing.every(function (x) { return x === ''; });
  if (kosong) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    return;
  }
  var missing = headers.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length) {
    sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
}

function _applyTextFormat(sh, headers) {
  var maxRows = sh.getMaxRows();
  if (maxRows < 2) return;
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var c = 0; c < hdr.length; c++) {
    if (TEXT_HEADERS[hdr[c]]) sh.getRange(2, c + 1, maxRows - 1, 1).setNumberFormat('@');
  }
}

function _protectWarn(sh) {
  try {
    if (sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) return;
    sh.protect().setWarningOnly(true);
  } catch (e) {}
}

function _seedSettings() {
  var existing = {};
  _readSheet(SHEETS.SETTINGS).forEach(function (r) { existing[r.key] = true; });
  var defaults = {
    tempoh_alert_expiry_hari: 90, tempoh_expiry_kritikal_hari: 30, benarkan_jual_expiry: 'NO',
    tempoh_slow_moving_hari: 60, tempoh_velocity_hari: 30, had_backdate_hari: 7, sesi_tamat_jam: 12,
    backup_folder_id: '', backup_simpan_hari: 30, snapshot_aktif: 'NO', snapshot_ambang_baris: 20000,
    ledger_amaran_baris: 40000, snapshot_semasa: '', nilai_minimum_diskaun_lulus_admin: 200,
    void_warehouse_hari_sama: 'YES', admin_email: '',
    whatsapp_template_do: 'Salam {nama}! DO {doc_no} jumlah RM{jumlah}. Terima kasih beli dengan Olin Beauty 💛',
    nama_syarikat: 'OLIN BEAUTY', alamat_syarikat: 'Negeri Sembilan'
  };
  var toAdd = [];
  Object.keys(defaults).forEach(function (k) { if (!existing[k]) toAdd.push({ key: k, value: defaults[k] }); });
  if (toAdd.length) _appendRowsByHeader(SHEETS.SETTINGS, toAdd);
}

function _seedCounters() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('seq_OBSB')) props.setProperty('seq_OBSB', '154'); // legacy OBSB0154
}

function _seedAdmin() {
  if (_readSheet(SHEETS.STAFF).length) return; // dah ada staf
  var salt = Utilities.getUuid().slice(0, 12);
  _appendRowsByHeader(SHEETS.STAFF, [{
    staff_id: 'STF-01', nama: 'Puan Olin', no_tel: '', role: 'ADMIN', outlet_id: '',
    pin_salt: salt, pin_hash: _sha256('123456' + salt), aktif: 'YES',
    updated_by: 'SYSTEM', updated_at: _nowKL()
  }]);
}

// ===================== HELPER: UPDATE ROW IN-PLACE =====================
function _updateRow(sheetName, rowNum, obj) {
  var sh = _sheet(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var vals = headers.map(function (h) { return (obj[h] === undefined || obj[h] === null) ? '' : obj[h]; });
  sh.getRange(rowNum, 1, 1, headers.length).setValues([vals]);
}

// ===================== HELPER: BAKI MAP =====================
/**
 * Baca semua LEDGER → bina map {sku: {lokasi: {batch_id: {qty, kos_seunit_rm}}}}.
 * Baki dikira live (SUM qty). Tiada nilai stok tersimpan di mana-mana.
 */
function _bakiMap() {
  var rows = _readSheet(SHEETS.LEDGER);
  var map = {};
  rows.forEach(function (r) {
    var sku = String(r.sku || '');
    var lok = String(r.lokasi || '');
    var bid = String(r.batch_id || '');
    if (!sku || !lok || !bid) return;
    if (!map[sku]) map[sku] = {};
    if (!map[sku][lok]) map[sku][lok] = {};
    if (!map[sku][lok][bid]) map[sku][lok][bid] = { qty: 0, kos_seunit_rm: 0 };
    map[sku][lok][bid].qty += _num(r.qty);
    if (_num(r.kos_seunit_rm) > 0) map[sku][lok][bid].kos_seunit_rm = _num(r.kos_seunit_rm);
  });
  return map;
}

// ===================== ACTIONS M1: BACA =====================
function a_getStock() {
  var baki = _bakiMap();
  var btMap = {};
  _readSheet(SHEETS.BATCH).forEach(function (b) { btMap[String(b.batch_id)] = b; });
  var pMap = {};
  _readSheet(SHEETS.PRODUK).forEach(function (p) { pMap[String(p.sku)] = p; });

  var out = [];
  // Produk dari MASTER_PRODUK (termasuk yang baki 0)
  Object.keys(pMap).forEach(function (sku) {
    var p = pMap[sku];
    var lokMap = baki[sku] || {};
    var batchList = [];
    Object.keys(lokMap).forEach(function (lok) {
      Object.keys(lokMap[lok]).forEach(function (bid) {
        var entry = lokMap[lok][bid];
        if (entry.qty === 0) return;
        var bt = btMap[bid] || {};
        batchList.push({
          batch_id: bid, batch_no: bt.batch_no || '', expiry: bt.expiry || '',
          ada_expiry: String(bt.ada_expiry || 'TIDAK').toUpperCase(),
          lokasi: lok, qty: entry.qty, kos_seunit_rm: entry.kos_seunit_rm
        });
      });
    });
    var totalQty = batchList.reduce(function (s, b) { return s + b.qty; }, 0);
    out.push({
      sku: sku, nama: p.nama || sku, kategori: p.kategori || '',
      jenis_item: p.jenis_item || 'PRODUK',
      ada_expiry: String(p.ada_expiry || 'TIDAK').toUpperCase(),
      aktif: String(p.aktif || 'YES').toUpperCase(),
      min_stok_wh: _num(p.min_stok_wh), total_qty: totalQty, batches: batchList
    });
  });
  // Anomali: baki wujud tapi tiada dalam master
  Object.keys(baki).forEach(function (sku) {
    if (pMap[sku]) return;
    var batchList = [];
    Object.keys(baki[sku]).forEach(function (lok) {
      Object.keys(baki[sku][lok]).forEach(function (bid) {
        var entry = baki[sku][lok][bid];
        if (entry.qty === 0) return;
        var bt = btMap[bid] || {};
        batchList.push({ batch_id: bid, batch_no: bt.batch_no || '', expiry: bt.expiry || '',
          ada_expiry: 'TIDAK', lokasi: lok, qty: entry.qty, kos_seunit_rm: entry.kos_seunit_rm });
      });
    });
    var totalQty = batchList.reduce(function (s, b) { return s + b.qty; }, 0);
    if (totalQty !== 0) out.push({ sku: sku, nama: '⚠ Tiada dalam master', kategori: '', jenis_item: '',
      ada_expiry: 'TIDAK', aktif: '?', min_stok_wh: 0, total_qty: totalQty, batches: batchList });
  });
  out.sort(function (a, b) { return (a.nama < b.nama) ? -1 : 1; });
  return _ok({ stok: out });
}

function a_getExpiryAlerts() {
  var cfg = _settingsMap();
  var alertHari = Number(cfg.tempoh_alert_expiry_hari || 90);
  var kritHari = Number(cfg.tempoh_expiry_kritikal_hari || 30);
  var todayMs = new Date(_todayKL()).getTime();
  var baki = _bakiMap();
  var btMap = {};
  _readSheet(SHEETS.BATCH).forEach(function (b) { btMap[String(b.batch_id)] = b; });
  var pMap = {};
  _readSheet(SHEETS.PRODUK).forEach(function (p) { pMap[String(p.sku)] = p; });

  var alerts = [];
  Object.keys(baki).forEach(function (sku) {
    Object.keys(baki[sku]).forEach(function (lok) {
      Object.keys(baki[sku][lok]).forEach(function (bid) {
        var entry = baki[sku][lok][bid];
        if (entry.qty <= 0) return;
        var bt = btMap[bid];
        if (!bt || String(bt.ada_expiry).toUpperCase() !== 'YES' || !bt.expiry) return;
        var diffDays = Math.floor((new Date(bt.expiry).getTime() - todayMs) / 86400000);
        if (diffDays > alertHari) return;
        var p = pMap[sku] || {};
        alerts.push({
          sku: sku, nama: p.nama || sku, batch_id: bid, batch_no: bt.batch_no || '',
          expiry: bt.expiry, lokasi: lok, qty: entry.qty, hari_tinggal: diffDays,
          tahap: diffDays <= 0 ? 'LUPUT' : diffDays <= kritHari ? 'KRITIKAL' : 'AMARAN'
        });
      });
    });
  });
  alerts.sort(function (a, b) { return a.hari_tinggal - b.hari_tinggal; });
  return _ok({ alerts: alerts });
}

// ===================== ACTIONS M1: TULIS =====================
function a_upsertProduk(body) {
  var p = body.produk;
  if (!p || !String(p.sku || '').trim()) return _err('SKU diperlukan.');
  var sku = String(p.sku).trim().toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(sku)) return _err('SKU: huruf besar, nombor, - atau _ sahaja.');
  if (!String(p.nama || '').trim()) return _err('Nama produk diperlukan.');
  return _withLock(function () {
    var existing = _findOne(SHEETS.PRODUK, function (r) { return String(r.sku) === sku; });
    var row = {
      sku: sku, nama: String(p.nama).trim(),
      kategori: String(p.kategori || '').trim(),
      jenis_item: String(p.jenis_item || 'PRODUK').toUpperCase(),
      ada_expiry: String(p.ada_expiry || 'YES').toUpperCase(),
      kos_rujukan_rm: _rm(_sen(p.kos_rujukan_rm)),
      harga_ejen_rm: _rm(_sen(p.harga_ejen_rm)),
      harga_outlet_rm: _rm(_sen(p.harga_outlet_rm)),
      harga_runcit_rm: _rm(_sen(p.harga_runcit_rm)),
      berat_gram: _num(p.berat_gram), min_stok_wh: _num(p.min_stok_wh),
      aktif: String(p.aktif || 'YES').toUpperCase(),
      updated_by: body._sess.staff_id, updated_at: _nowKL()
    };
    if (existing) { _updateRow(SHEETS.PRODUK, existing.__row, row); }
    else { _appendRowsByHeader(SHEETS.PRODUK, [row]); }
    _settingsMemo = null;
    _audit(body._sess.staff_id, 'upsertProduk', sku, existing ? 'kemaskini' : 'baru');
    return _ok({ sku: sku, mod: existing ? 'kemaskini' : 'baru' });
  });
}

function a_upsertEjen(body) {
  var e = body.ejen;
  if (!e || !String(e.ejen_id || '').trim()) return _err('ID Ejen diperlukan.');
  var eid = String(e.ejen_id).trim().toUpperCase();
  if (!String(e.nama || '').trim()) return _err('Nama ejen diperlukan.');
  return _withLock(function () {
    var existing = _findOne(SHEETS.EJEN, function (r) { return String(r.ejen_id) === eid; });
    var row = {
      ejen_id: eid, nama: String(e.nama).trim(), no_tel: String(e.no_tel || '').trim(),
      kawasan: String(e.kawasan || '').trim(),
      target_bulanan_rm: _rm(_sen(e.target_bulanan_rm)),
      aktif: String(e.aktif || 'YES').toUpperCase(),
      pin_portal_salt: existing ? String(existing.pin_portal_salt || '') : '',
      pin_portal_hash: existing ? String(existing.pin_portal_hash || '') : '',
      updated_by: body._sess.staff_id, updated_at: _nowKL()
    };
    if (existing) { _updateRow(SHEETS.EJEN, existing.__row, row); }
    else { _appendRowsByHeader(SHEETS.EJEN, [row]); }
    _audit(body._sess.staff_id, 'upsertEjen', eid, existing ? 'kemaskini' : 'baru');
    return _ok({ ejen_id: eid, mod: existing ? 'kemaskini' : 'baru' });
  });
}

function a_upsertOutlet(body) {
  var o = body.outlet;
  if (!o || !String(o.outlet_id || '').trim()) return _err('ID Outlet diperlukan.');
  var oid = String(o.outlet_id).trim().toUpperCase();
  if (!String(o.nama || '').trim()) return _err('Nama outlet diperlukan.');
  return _withLock(function () {
    var existing = _findOne(SHEETS.OUTLET, function (r) { return String(r.outlet_id) === oid; });
    var row = {
      outlet_id: oid, nama: String(o.nama).trim(), alamat: String(o.alamat || '').trim(),
      no_tel: String(o.no_tel || '').trim(), aktif: String(o.aktif || 'YES').toUpperCase(),
      pin_portal_salt: existing ? String(existing.pin_portal_salt || '') : '',
      pin_portal_hash: existing ? String(existing.pin_portal_hash || '') : '',
      updated_by: body._sess.staff_id, updated_at: _nowKL()
    };
    if (existing) { _updateRow(SHEETS.OUTLET, existing.__row, row); }
    else { _appendRowsByHeader(SHEETS.OUTLET, [row]); }
    _audit(body._sess.staff_id, 'upsertOutlet', oid, existing ? 'kemaskini' : 'baru');
    return _ok({ outlet_id: oid, mod: existing ? 'kemaskini' : 'baru' });
  });
}

function a_getStaffList(body) {
  // Senarai staf untuk Master → Staf. pin_salt/pin_hash SENGAJA tidak dihantar.
  var rows = _readSheet(SHEETS.STAFF).map(function (r) {
    return {
      staff_id: String(r.staff_id || ''), nama: String(r.nama || ''),
      no_tel: String(r.no_tel || ''), role: String(r.role || ''),
      outlet_id: String(r.outlet_id || ''), aktif: String(r.aktif || ''),
      updated_at: String(r.updated_at || '')
    };
  }).filter(function (r) { return r.staff_id; });
  return _ok({ staf_list: rows });
}

function a_upsertStaff(body) {
  var s = body.staf;
  if (!s || !String(s.staff_id || '').trim()) return _err('ID Staf diperlukan.');
  var sid = String(s.staff_id).trim().toUpperCase();
  if (!String(s.nama || '').trim()) return _err('Nama staf diperlukan.');
  var role = String(s.role || 'WAREHOUSE').toUpperCase();
  if (role !== 'ADMIN' && role !== 'WAREHOUSE') return _err('Role mesti ADMIN atau WAREHOUSE.');
  return _withLock(function () {
    var existing = _findOne(SHEETS.STAFF, function (r) { return String(r.staff_id) === sid; });
    var salt = existing ? String(existing.pin_salt || '') : Utilities.getUuid().slice(0, 12);
    var hash = existing ? String(existing.pin_hash || '') : '';
    if (s.pin_baru) {
      if (String(s.pin_baru).length < 6) return _err('PIN mestilah sekurang-kurangnya 6 digit.');
      salt = Utilities.getUuid().slice(0, 12);
      hash = _sha256(String(s.pin_baru) + salt);
    } else if (!existing) {
      return _err('PIN diperlukan untuk staf baru.');
    }
    var row = {
      staff_id: sid, nama: String(s.nama).trim(), no_tel: String(s.no_tel || '').trim(),
      role: role, outlet_id: String(s.outlet_id || '').trim().toUpperCase(),
      pin_salt: salt, pin_hash: hash, aktif: String(s.aktif || 'YES').toUpperCase(),
      updated_by: body._sess.staff_id, updated_at: _nowKL()
    };
    if (existing) { _updateRow(SHEETS.STAFF, existing.__row, row); }
    else { _appendRowsByHeader(SHEETS.STAFF, [row]); }
    _audit(body._sess.staff_id, 'upsertStaff', sid, existing ? 'kemaskini' : 'baru');
    return _ok({ staff_id: sid, mod: existing ? 'kemaskini' : 'baru' });
  });
}

function a_saveSettings(body) {
  var pairs = body.pairs;
  if (!Array.isArray(pairs) || !pairs.length) return _err('Tiada tetapan untuk disimpan.');
  return _withLock(function () {
    var rows = _readSheet(SHEETS.SETTINGS);
    var keyToRow = {};
    rows.forEach(function (r) { keyToRow[String(r.key)] = r.__row; });
    var sh = _sheet(SHEETS.SETTINGS);
    pairs.forEach(function (pair) {
      var k = String(pair.key || '').trim();
      var v = String(pair.value === undefined ? '' : pair.value);
      if (!k) return;
      if (keyToRow[k]) { sh.getRange(keyToRow[k], 2).setValue(v); }
      else { _appendRowsByHeader(SHEETS.SETTINGS, [{ key: k, value: v }]); }
    });
    _settingsMemo = null;
    _audit(body._sess.staff_id, 'saveSettings', 'SETTINGS',
      JSON.stringify(pairs.map(function (p) { return p.key; })));
    return _ok({});
  });
}

// ===================== ACTIONS M2: STOK MASUK (GRN) =====================
function a_addGRN(body) {
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var pembekal = String(body.pembekal || '').trim();
  var catatan = String(body.catatan || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines;

  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 produk diperlukan.');

  // Validate tarikh
  var cfg = _settingsMap();
  var hadBackdate = Number(cfg.had_backdate_hari || 7);
  var cutoffMs = new Date(_todayKL()).getTime() - hadBackdate * 86400000;
  if (new Date(tarikh).getTime() < cutoffMs) return _err('Tarikh melebihi had backdate ' + hadBackdate + ' hari.');
  if (new Date(tarikh).getTime() > new Date(_todayKL()).getTime()) return _err('Tarikh tidak boleh hadapan.');

  // Validate setiap baris (sebelum lock)
  var pMap = {};
  _readSheet(SHEETS.PRODUK).forEach(function (p) { pMap[String(p.sku)] = p; });
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var sku = String(l.sku || '').trim().toUpperCase();
    if (!sku) return _err('Baris ' + (i + 1) + ': SKU diperlukan.');
    if (!pMap[sku]) return _err('Baris ' + (i + 1) + ': SKU "' + sku + '" tiada dalam master.');
    if (_num(l.qty) <= 0 || Math.floor(_num(l.qty)) !== _num(l.qty)) return _err('Baris ' + (i + 1) + ': Kuantiti mesti integer > 0.');
    if (_num(l.kos_seunit_rm) < 0) return _err('Baris ' + (i + 1) + ': Kos tidak boleh negatif.');
    if (!String(l.batch_no || '').trim()) return _err('Baris ' + (i + 1) + ': Nombor batch diperlukan.');
    if (String(pMap[sku].ada_expiry).toUpperCase() === 'YES' && !String(l.expiry || '').trim()) {
      return _err('Baris ' + (i + 1) + ': Expiry diperlukan untuk ' + sku + '.');
    }
  }

  return _withLock(function () {
    // Idempotency — check client_ref dalam DOC_HEADER
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), jumlah_rm: _num(dup.jumlah_bersih_rm), bilangan_baris: lines.length, mod: 'idempoten' });
    }

    var now = _nowKL();
    var docNo = _nextDocNo('GRN');
    var docId = _uid('DH-');
    var totalKosSen = 0;
    var batchRows = [], ledgerRows = [], lineRows = [];

    lines.forEach(function (l) {
      var sku = String(l.sku).trim().toUpperCase();
      var qty = Math.floor(_num(l.qty));
      var kosSen = _sen(l.kos_seunit_rm);
      var kosRm = _rm(kosSen);
      var p = pMap[sku];
      var batchId = _uid('BT-');
      var adaExpiry = String(p.ada_expiry).toUpperCase() === 'YES' ? 'YES' : 'TIDAK';

      batchRows.push({
        batch_id: batchId, sku: sku,
        batch_no: String(l.batch_no).trim(),
        expiry: adaExpiry === 'YES' ? String(l.expiry || '').trim() : '',
        ada_expiry: adaExpiry,
        kos_seunit_rm: kosRm, kos_anggaran: 'NO',
        lokasi_rak: String(l.lokasi_rak || '').trim(),
        grn_doc_no: docNo, tarikh_terima: tarikh,
        created_by: body._sess.staff_id, created_at: now
      });

      ledgerRows.push({
        ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh,
        doc_no: docNo, doc_type: 'GRN',
        sku: sku, batch_id: batchId,
        arah: 1, qty: qty,
        lokasi: 'WAREHOUSE', kos_seunit_rm: kosRm,
        pihak: pembekal, is_reversal: 'NO', reversal_of: '',
        created_by: body._sess.staff_id
      });

      lineRows.push({
        line_id: _uid('LN-'), doc_id: docId, doc_no: docNo,
        sku: sku, nama_produk: String(p.nama || sku),
        qty: qty, harga_seunit_rm: kosRm,
        jumlah_rm: _rm(qty * kosSen),
        disposisi: 'MASUK', batch_id_rujukan: batchId, catatan_line: ''
      });

      totalKosSen += qty * kosSen;
    });

    var totalRm = _rm(totalKosSen);

    // Susunan tulis SELAMAT (baki-safe, §4.2/I3): BATCH → DOC_HEADER → DOC_LINES → LEDGER terakhir.
    // Jika script mati sebelum LEDGER → dokumen wujud tanpa kesan stok (baki SELAMAT); I3 tangkap header tergantung.
    _appendRowsByHeader(SHEETS.BATCH, batchRows);
    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: 'GRN', subjenis: '',
      tarikh: tarikh, pihak_jenis: 'PEMBEKAL', pihak_id: pembekal,
      lokasi_sasaran: 'WAREHOUSE',
      subtotal_rm: totalRm, diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0,
      postage_rm: 0, jumlah_bersih_rm: totalRm,
      kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: '',
      status: 'AKTIF', void_reason: '', void_by: '', void_at: '',
      catatan: catatan, client_ref: clientRef,
      created_by: body._sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows); // LEDGER TERAKHIR

    _audit(body._sess.staff_id, 'addGRN', docNo, lines.length + ' baris, RM' + totalRm);
    return _ok({ doc_no: docNo, jumlah_rm: totalRm, bilangan_baris: lines.length });
  });
}

// ===================== M3: ENJIN FEFO + KIRAAN DO =====================
function _produkMap() { var m = {}; _readSheet(SHEETS.PRODUK).forEach(function (p) { m[String(p.sku)] = p; }); return m; }
function _batchMap() { var m = {}; _readSheet(SHEETS.BATCH).forEach(function (b) { m[String(b.batch_id)] = b; }); return m; }

/** Tambah hari pada tarikh yyyy-MM-dd, pulang yyyy-MM-dd (KL). */
function _addDaysKL(dateStr, days) {
  return Utilities.formatDate(new Date(new Date(dateStr).getTime() + days * 86400000), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
}

/**
 * Agih stok FEFO (§4.3). Satu fungsi untuk semua keluaran (DO/transfer/jualan outlet).
 * Susun: ada_expiry dulu ikut expiry MENAIK → batch tanpa-expiry di HUJUNG → tie tarikh_terima → batch_id.
 * Pulang { allocation[], warnings[], expiredSkipped[], shortfall, tersedia }.
 */
function _allocateFIFO(baki, batchMap, sku, qtyReq, lokasi, hariIni, benarkanExpiry, alertHari) {
  var lokMap = (baki[sku] && baki[sku][lokasi]) ? baki[sku][lokasi] : {};
  var cutoffAlert = _addDaysKL(hariIni, alertHari);
  var cands = [], expiredSkipped = [];
  Object.keys(lokMap).forEach(function (bid) {
    var q = _num(lokMap[bid].qty);
    if (q <= 0) return;
    var bt = batchMap[bid] || {};
    var adaExp = String(bt.ada_expiry || 'TIDAK').toUpperCase() === 'YES';
    var exp = String(bt.expiry || '').trim();
    if (adaExp && exp && !benarkanExpiry && exp < hariIni) {
      expiredSkipped.push({ batch_id: bid, batch_no: String(bt.batch_no || ''), expiry: exp, qty: q });
      return;
    }
    cands.push({
      batch_id: bid, baki: q, ada_expiry: adaExp, expiry: exp,
      tarikh_terima: String(bt.tarikh_terima || ''), batch_no: String(bt.batch_no || ''),
      rak: String(bt.lokasi_rak || ''),
      kos: _num(lokMap[bid].kos_seunit_rm) > 0 ? _num(lokMap[bid].kos_seunit_rm) : _num(bt.kos_seunit_rm)
    });
  });
  cands.sort(function (a, b) {
    if (a.ada_expiry !== b.ada_expiry) return a.ada_expiry ? -1 : 1;            // ber-expiry dulu
    if (a.ada_expiry && b.ada_expiry && a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1; // expiry menaik
    if (a.tarikh_terima !== b.tarikh_terima) return a.tarikh_terima < b.tarikh_terima ? -1 : 1;      // tie: terima menaik
    return a.batch_id < b.batch_id ? -1 : 1;                                    // tie: batch_id (deterministik)
  });
  var tersedia = cands.reduce(function (s, c) { return s + c.baki; }, 0);
  var remaining = qtyReq, allocation = [], warnings = [];
  for (var i = 0; i < cands.length && remaining > 0; i++) {
    var c = cands[i];
    var take = Math.min(c.baki, remaining);
    if (take <= 0) continue;
    allocation.push({ batch_id: c.batch_id, batch_no: c.batch_no, ambil: take, kos_seunit_rm: c.kos, expiry: c.expiry, rak: c.rak, ada_expiry: c.ada_expiry });
    if (c.ada_expiry && c.expiry && c.expiry <= cutoffAlert) {
      warnings.push({ sku: sku, batch_id: c.batch_id, batch_no: c.batch_no, expiry: c.expiry, ambil: take });
    }
    remaining -= take;
  }
  return { allocation: allocation, warnings: warnings, expiredSkipped: expiredSkipped, shortfall: remaining, tersedia: tersedia };
}

/**
 * Bina & sahkan DO dari body. Dipakai previewDO (baca) & addDOEjen (dalam lock).
 * Pulang {ok:true, perLine, subtotalSen, diskaunSen, postageSen, jumlahSen, warnings, expiredSkipped, diskaunJenis, diskaunInput}
 * atau {ok:false, message}.
 */
function _computeDO(body, baki, pMap, batchMap, cfg) {
  var lines = body.lines || [];
  if (!lines.length) return { ok: false, message: 'Tiada produk.' };
  var benarkanExpiry = String(cfg.benarkan_jual_expiry || 'NO').toUpperCase() === 'YES';
  var alertHari = Number(cfg.tempoh_alert_expiry_hari || 90);
  var hariIni = _todayKL();
  var perLine = [], allWarnings = [], allExpired = [], subtotalSen = 0;

  // Kumpul ikut SKU DULU — elak oversell bila SKU sama berulang dalam 1 DO
  // (_allocateFIFO tak tolak baki antara baris; setiap SKU mesti diagih SEKALI sahaja).
  // Ini juga jamin satu DOC_LINES per SKU (invariant I3).
  var agg = {}, order = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var skuI = String(l.sku || '').trim().toUpperCase();
    if (!skuI) return { ok: false, message: 'Baris ' + (i + 1) + ': SKU diperlukan.' };
    var qtyRaw = _num(l.qty);
    var qtyI = Math.floor(qtyRaw);
    if (qtyI <= 0 || qtyI !== qtyRaw) return { ok: false, message: 'Baris ' + (i + 1) + ' (' + skuI + '): Kuantiti mesti integer > 0.' };
    if (!agg[skuI]) { agg[skuI] = { sku: skuI, qty: 0, gift: !!l.gift }; order.push(skuI); }
    agg[skuI].qty += qtyI;
    if (!l.gift) agg[skuI].gift = false; // mana-mana baris bukan-hadiah → SKU jadi berharga
  }

  for (var j = 0; j < order.length; j++) {
    var a0 = agg[order[j]];
    var sku = a0.sku, qty = a0.qty;
    var p = pMap[sku];
    if (!p) return { ok: false, message: 'SKU "' + sku + '" tiada dalam master.' };
    if (String(p.aktif).toUpperCase() !== 'YES') return { ok: false, message: sku + ' tidak aktif.' };
    var isGift = a0.gift;
    var hargaSen = isGift ? 0 : _sen(p.harga_ejen_rm);
    if (!isGift && hargaSen <= 0) return { ok: false, message: sku + ' tiada harga ejen — lengkapkan di Master atau tanda sebagai Hadiah.' };
    var alloc = _allocateFIFO(baki, batchMap, sku, qty, 'WAREHOUSE', hariIni, benarkanExpiry, alertHari);
    if (alloc.shortfall > 0) {
      var msg = 'Stok ' + sku + ' tidak mencukupi di WH. Diminta ' + qty + ', ada ' + alloc.tersedia + '.';
      if (alloc.expiredSkipped.length) msg += ' (' + alloc.expiredSkipped.length + ' batch EXPIRED dilangkau — buat write-off/pindah ROSAK.)';
      return { ok: false, message: msg };
    }
    var lineSen = qty * hargaSen;
    subtotalSen += lineSen;
    alloc.warnings.forEach(function (w) { allWarnings.push(w); });
    alloc.expiredSkipped.forEach(function (e) { e.sku = sku; allExpired.push(e); });
    perLine.push({ sku: sku, nama: String(p.nama || sku), qty: qty, harga_ejen_sen: hargaSen, gift: isGift, allocation: alloc.allocation, line_sen: lineSen });
  }

  // diskaun (§4.6) — semua dalam sen
  var diskaunJenis = String(body.diskaun_jenis || '-').toUpperCase();
  if (diskaunJenis === 'TIADA') diskaunJenis = '-';
  var diskaunInput = _num(body.diskaun_input);
  var diskaunSen = 0;
  if (diskaunJenis === 'PERATUS') {
    if (diskaunInput < 0 || diskaunInput > 100) return { ok: false, message: 'Peratus diskaun mesti 0–100.' };
    diskaunSen = Math.round(subtotalSen * diskaunInput / 100);
  } else if (diskaunJenis === 'RM') {
    diskaunSen = _sen(diskaunInput);
  }
  if (diskaunSen < 0) return { ok: false, message: 'Diskaun tidak boleh negatif.' };
  if (diskaunSen > subtotalSen) return { ok: false, message: 'Diskaun (' + _rm(diskaunSen) + ') melebihi subtotal (' + _rm(subtotalSen) + ').' };

  var postageSen = _sen(body.postage);
  if (postageSen < 0) return { ok: false, message: 'Postage tidak boleh negatif.' };
  var jumlahSen = subtotalSen - diskaunSen + postageSen;

  return {
    ok: true, perLine: perLine, subtotalSen: subtotalSen, diskaunSen: diskaunSen,
    postageSen: postageSen, jumlahSen: jumlahSen, warnings: allWarnings, expiredSkipped: allExpired,
    diskaunJenis: diskaunJenis, diskaunInput: diskaunInput
  };
}

function _previewLines(perLine) {
  return perLine.map(function (pl) {
    return {
      sku: pl.sku, nama: pl.nama, qty: pl.qty, gift: pl.gift,
      harga_seunit_rm: _rm(pl.harga_ejen_sen), jumlah_rm: _rm(pl.line_sen),
      allocation: pl.allocation.map(function (a) {
        return { batch_no: a.batch_no || '(tiada batch)', ambil: a.ambil, expiry: a.expiry, rak: a.rak };
      })
    };
  });
}

// ===================== ACTIONS M3 =====================
function a_previewDO(body) {
  var r = _computeDO(body, _bakiMap(), _produkMap(), _batchMap(), _settingsMap());
  if (!r.ok) return _err(r.message);
  return _ok({
    lines: _previewLines(r.perLine),
    subtotal_rm: _rm(r.subtotalSen), diskaun_rm: _rm(r.diskaunSen),
    diskaun_jenis: r.diskaunJenis, diskaun_input: r.diskaunInput,
    postage_rm: _rm(r.postageSen), jumlah_bersih_rm: _rm(r.jumlahSen),
    warnings: r.warnings, expired_skipped: r.expiredSkipped
  });
}

function a_addDOEjen(body) {
  var sess = body._sess;
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var ejenId = String(body.ejen_id || '').trim().toUpperCase();
  var catatan = String(body.catatan || '').trim();
  var rujukanWeb = String(body.rujukan_order_web || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines;
  var sahkanExpiry = !!body.sahkanAmaranExpiry;

  if (!ejenId) return _err('Sila pilih ejen.');
  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 produk diperlukan.');

  var cfg = _settingsMap();
  var hadBackdate = Number(cfg.had_backdate_hari || 7);
  var todayMs = new Date(_todayKL()).getTime();
  if (new Date(tarikh).getTime() < todayMs - hadBackdate * 86400000) return _err('Tarikh melebihi had backdate ' + hadBackdate + ' hari.');
  if (new Date(tarikh).getTime() > todayMs) return _err('Tarikh tidak boleh hadapan.');

  var ejen = _findOne(SHEETS.EJEN, function (e) { return String(e.ejen_id) === ejenId; });
  if (!ejen) return _err('Ejen "' + ejenId + '" tiada dalam master.');
  if (String(ejen.aktif).toUpperCase() !== 'YES') return _err('Ejen "' + ejenId + '" tidak aktif.');

  return _withLock(function () {
    // idempotency — semak DALAM lock terhadap sheet (bukan cache)
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), jumlah_bersih_rm: _num(dup.jumlah_bersih_rm), duplicate: true, mod: 'idempoten', ejen_id: ejenId, ejen_nama: String(ejen.nama || '') });
    }

    // baca SEGAR dalam lock; allocation dikira semula (preview tak dipercayai)
    var r = _computeDO(body, _bakiMap(), _produkMap(), _batchMap(), cfg);
    if (!r.ok) return _err(r.message);

    // had diskaun ADMIN
    var hadAdminSen = _sen(cfg.nilai_minimum_diskaun_lulus_admin || 200);
    if (r.diskaunSen > hadAdminSen && sess.role !== 'ADMIN') {
      return _err('Diskaun ' + _rm(r.diskaunSen) + ' melebihi had ' + _rm(hadAdminSen) + ' — perlu kelulusan Admin.');
    }

    // sahkan batch hampir luput (2-langkah)
    if (r.warnings.length && !sahkanExpiry) {
      return { status: 'CONFIRM_EXPIRY', warnings: r.warnings, message: 'Ada batch hampir luput dalam pengagihan. Sila sahkan untuk teruskan.' };
    }

    var now = _nowKL();
    var docNo = _nextDocNo('OBSB');
    var docId = _uid('DH-');
    var ledgerRows = [], lineRows = [], allocOut = [];

    r.perLine.forEach(function (pl) {
      pl.allocation.forEach(function (a) {
        ledgerRows.push({
          ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh,
          doc_no: docNo, doc_type: 'DO_EJEN', sku: pl.sku, batch_id: a.batch_id,
          arah: -1, qty: -a.ambil, lokasi: 'WAREHOUSE', kos_seunit_rm: _rm(_sen(a.kos_seunit_rm)),
          pihak: ejenId, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id
        });
      });
      lineRows.push({
        line_id: _uid('LN-'), doc_id: docId, doc_no: docNo, sku: pl.sku,
        nama_produk: pl.nama, qty: pl.qty, harga_seunit_rm: _rm(pl.harga_ejen_sen),
        jumlah_rm: _rm(pl.line_sen), disposisi: 'KELUAR',
        batch_id_rujukan: pl.allocation.length === 1 ? pl.allocation[0].batch_id : '',
        catatan_line: pl.gift ? 'HADIAH' : ''
      });
      allocOut.push({ sku: pl.sku, nama: pl.nama, qty: pl.qty, gift: pl.gift, batches: pl.allocation });
    });

    // Susunan tulis SELAMAT: DOC_HEADER → DOC_LINES → LEDGER terakhir (baki-safe)
    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: 'DO_EJEN', subjenis: 'BIASA',
      tarikh: tarikh, pihak_jenis: 'EJEN', pihak_id: ejenId, lokasi_sasaran: 'WAREHOUSE',
      subtotal_rm: _rm(r.subtotalSen), diskaun_jenis: r.diskaunJenis === '-' ? '' : r.diskaunJenis,
      diskaun_input: r.diskaunInput, diskaun_rm: _rm(r.diskaunSen),
      postage_rm: _rm(r.postageSen), jumlah_bersih_rm: _rm(r.jumlahSen),
      kurier: String(body.kurier || ''), no_tracking: String(body.no_tracking || ''), berat_kg: _num(body.berat_kg),
      rujukan_order_web: rujukanWeb, status: 'AKTIF', void_reason: '', void_by: '', void_at: '',
      catatan: catatan, client_ref: clientRef, created_by: sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows); // LEDGER TERAKHIR + flush() oleh _withLock

    _audit(sess.staff_id, 'addDOEjen', docNo, ejenId + ' · ' + r.perLine.length + ' baris · RM' + _rm(r.jumlahSen));
    return _ok({
      doc_no: docNo, ejen_id: ejenId, ejen_nama: String(ejen.nama || ''), ejen_tel: String(ejen.no_tel || ''),
      tarikh: tarikh, subtotal_rm: _rm(r.subtotalSen), diskaun_rm: _rm(r.diskaunSen),
      diskaun_jenis: r.diskaunJenis === '-' ? '' : r.diskaunJenis, diskaun_input: r.diskaunInput,
      postage_rm: _rm(r.postageSen), jumlah_bersih_rm: _rm(r.jumlahSen),
      catatan: catatan, rujukan_order_web: rujukanWeb,
      allocation: allocOut, warnings: r.warnings
    });
  });
}

// ===================== M4a: BAYARAN + AKAUN EJEN =====================
/**
 * Agregat PAYMENTS AKTIF: {dibayar:{doc_no→sen}, credit:{ejen_id→sen}}.
 * Status bayaran TIDAK disimpan — dikira. Wang dalam sen integer.
 * Baki kredit = Σ(KREDIT bukan KREDIT_GUNA) − Σ(KREDIT kaedah KREDIT_GUNA).
 */
function _payAgg() {
  var dibayar = {}, credit = {};
  _readSheet(SHEETS.PAYMENTS).forEach(function (p) {
    if (String(p.status).toUpperCase() !== 'AKTIF') return;
    var docNo = String(p.doc_no || '');
    var ej = String(p.ejen_id || '').toUpperCase();
    var amt = _sen(p.amaun_rm);
    var kaedah = String(p.kaedah || '').toUpperCase();
    if (docNo === 'KREDIT') {
      credit[ej] = (credit[ej] || 0) + (kaedah === 'KREDIT_GUNA' ? -amt : amt);
    } else {
      dibayar[docNo] = (dibayar[docNo] || 0) + amt;
    }
  });
  return { dibayar: dibayar, credit: credit };
}

function _statusBayar(dibayarSen, bersihSen) {
  if (dibayarSen === 0) return 'BELUM';
  if (dibayarSen < bersihSen) return 'SEBAHAGIAN';
  if (dibayarSen === bersihSen) return 'LUNAS';
  return 'TERLEBIH';
}

/** Senarai DO_EJEN AKTIF utk ejen, tertua dahulu, dgn baki bayaran. */
function _dosEjen(ejenId, agg) {
  return _readSheet(SHEETS.DOC_HEADER)
    .filter(function (h) {
      return String(h.doc_type) === 'DO_EJEN' && String(h.pihak_id).toUpperCase() === ejenId &&
        String(h.status).toUpperCase() === 'AKTIF';
    })
    .map(function (h) {
      var bersihSen = _sen(h.jumlah_bersih_rm);
      var dibayarSen = agg.dibayar[String(h.doc_no)] || 0;
      return {
        doc_no: String(h.doc_no), tarikh: String(h.tarikh), bersihSen: bersihSen,
        dibayarSen: dibayarSen, bakiSen: bersihSen - dibayarSen
      };
    })
    .sort(function (a, b) { return a.tarikh < b.tarikh ? -1 : a.tarikh > b.tarikh ? 1 : (a.doc_no < b.doc_no ? -1 : 1); });
}

// ----- LEVEL 1: senarai akaun + ranking -----
function a_getAkaunRingkasan(body) {
  var bulan = String(body.bulan || _todayKL().slice(0, 7)); // yyyy-MM
  var agg = _payAgg();
  var headers = _readSheet(SHEETS.DOC_HEADER).filter(function (h) {
    return String(h.doc_type) === 'DO_EJEN' && String(h.status).toUpperCase() === 'AKTIF';
  });
  var hutangByEjen = {}, jualanByEjen = {};
  headers.forEach(function (h) {
    var ej = String(h.pihak_id).toUpperCase();
    var bakiSen = _sen(h.jumlah_bersih_rm) - (agg.dibayar[String(h.doc_no)] || 0);
    if (bakiSen > 0) hutangByEjen[ej] = (hutangByEjen[ej] || 0) + bakiSen;
    if (String(h.tarikh).slice(0, 7) === bulan) {
      jualanByEjen[ej] = (jualanByEjen[ej] || 0) + (_sen(h.subtotal_rm) - _sen(h.diskaun_rm)); // postage dikecualikan
    }
  });
  var list = _readSheet(SHEETS.EJEN)
    .filter(function (e) { return String(e.aktif).toUpperCase() === 'YES'; })
    .map(function (e) {
      var ej = String(e.ejen_id).toUpperCase();
      var jualSen = jualanByEjen[ej] || 0;
      var targetSen = _sen(e.target_bulanan_rm);
      return {
        ejen_id: e.ejen_id, nama: e.nama, no_tel: e.no_tel, kawasan: e.kawasan,
        hutang_rm: _rm(hutangByEjen[ej] || 0), kredit_rm: _rm(agg.credit[ej] || 0),
        jualan_bulan_rm: _rm(jualSen), target_rm: _rm(targetSen),
        pct_capai: targetSen > 0 ? Math.round(jualSen / targetSen * 100) : null
      };
    });
  list.sort(function (a, b) { return _sen(b.jualan_bulan_rm) - _sen(a.jualan_bulan_rm); });
  list.forEach(function (r, i) { r.rank = i + 1; });
  return _ok({ bulan: bulan, ejen: list });
}

// ----- LEVEL 2: statement seorang ejen -----
function a_getStatementEjen(body) {
  var ejenId = String(body.ejen_id || '').trim().toUpperCase();
  var ejen = _findOne(SHEETS.EJEN, function (e) { return String(e.ejen_id) === ejenId; });
  if (!ejen) return _err('Ejen tiada dalam master.');
  var agg = _payAgg();
  var dos = _dosEjen(ejenId, agg).map(function (d) {
    return {
      doc_no: d.doc_no, tarikh: d.tarikh, bersih_rm: _rm(d.bersihSen),
      dibayar_rm: _rm(d.dibayarSen), baki_rm: _rm(d.bakiSen), status: _statusBayar(d.dibayarSen, d.bersihSen)
    };
  });
  var payments = _readSheet(SHEETS.PAYMENTS)
    .filter(function (p) { return String(p.ejen_id).toUpperCase() === ejenId; })
    .map(function (p) {
      return {
        pay_no: p.pay_no, tarikh: String(p.tarikh), doc_no: p.doc_no, kaedah: p.kaedah,
        amaun_rm: _num(p.amaun_rm), rujukan_resit: p.rujukan_resit, status: p.status,
        catatan: p.catatan, created_at: String(p.created_at)
      };
    })
    .sort(function (a, b) { return String(b.created_at) < String(a.created_at) ? -1 : 1; }); // terbaru dulu
  var hutangSen = dos.reduce(function (s, d) { return s + Math.max(0, _sen(d.baki_rm)); }, 0);
  return _ok({
    ejen: { ejen_id: ejen.ejen_id, nama: ejen.nama, no_tel: ejen.no_tel, kawasan: ejen.kawasan, target_bulanan_rm: _num(ejen.target_bulanan_rm) },
    do: dos, payments: payments, baki_hutang_rm: _rm(hutangSen), baki_kredit_rm: _rm(agg.credit[ejenId] || 0)
  });
}

// ----- TULIS: rekod bayaran -----
function a_addPayment(body) {
  var sess = body._sess;
  var ejenId = String(body.ejen_id || '').trim().toUpperCase();
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var kaedah = String(body.kaedah || '').trim().toUpperCase();
  var rujukan = String(body.rujukan_resit || '').trim();
  var catatan = String(body.catatan || '').trim();
  var clientRef = String(body.client_ref || '');
  var force = !!body.force;
  var agihanIn = (Array.isArray(body.agihan) && body.agihan.length) ? body.agihan : null; // [] = auto-agih
  var amaunSen = _sen(body.amaun);

  var KAEDAH = { TUNAI: 1, TRANSFER: 1, CHEQUE: 1 }; // KREDIT_GUNA/KREDIT_RETURN = M5/auto
  if (!ejenId) return _err('Sila pilih ejen.');
  if (!KAEDAH[kaedah]) return _err('Kaedah bayaran tidak sah (TUNAI/TRANSFER/CHEQUE).');
  if (amaunSen <= 0) return _err('Amaun mesti lebih daripada 0.');

  var cfg = _settingsMap();
  var hadBackdate = Number(cfg.had_backdate_hari || 7);
  var todayMs = new Date(_todayKL()).getTime();
  if (new Date(tarikh).getTime() < todayMs - hadBackdate * 86400000) return _err('Tarikh melebihi had backdate ' + hadBackdate + ' hari.');
  if (new Date(tarikh).getTime() > todayMs) return _err('Tarikh tidak boleh hadapan.');

  var ejen = _findOne(SHEETS.EJEN, function (e) { return String(e.ejen_id) === ejenId; });
  if (!ejen) return _err('Ejen tiada dalam master.');

  return _withLock(function () {
    if (clientRef) {
      var dup = _findOne(SHEETS.PAYMENTS, function (p) { return String(p.client_ref) === clientRef; });
      if (dup) return _ok({ duplicate: true, mod: 'idempoten', pay_nos: [String(dup.pay_no)], ejen_id: ejenId, ejen_nama: String(ejen.nama || '') });
    }
    var agg = _payAgg();
    var dos = _dosEjen(ejenId, agg);
    var bakiDO = {};
    dos.forEach(function (d) { bakiDO[d.doc_no] = Math.max(0, d.bakiSen); });

    // tentukan agihan (sen)
    var alloc = [];
    if (agihanIn) {
      // gabung ikut doc_no (elak status_baru salah utk doc berulang) + cap baki per-DO
      var aggMap = {}, ordA = [], sum = 0;
      for (var i = 0; i < agihanIn.length; i++) {
        var dn = String(agihanIn[i].doc_no || '').trim();
        var sn = _sen(agihanIn[i].amaun);
        if (dn === 'KREDIT' || sn <= 0) continue;
        if (bakiDO[dn] === undefined) return _err('DO ' + dn + ' bukan DO AKTIF ejen ini.');
        if (!aggMap[dn]) { aggMap[dn] = 0; ordA.push(dn); }
        aggMap[dn] += sn; sum += sn;
      }
      for (var m = 0; m < ordA.length; m++) {
        var dnm = ordA[m];
        if (bakiDO[dnm] <= 0) return _err('DO ' + dnm + ' sudah LUNAS — tiada baki untuk dibayar.');
        if (aggMap[dnm] > bakiDO[dnm]) return _err('Agihan ke ' + dnm + ' (' + _rm(aggMap[dnm]) + ') melebihi baki DO (' + _rm(bakiDO[dnm]) + ').');
        alloc.push({ doc_no: dnm, sen: aggMap[dnm] });
      }
      if (sum > amaunSen) return _err('Jumlah agihan (' + _rm(sum) + ') melebihi amaun (' + _rm(amaunSen) + ').');
    } else {
      var remain = amaunSen;
      for (var j = 0; j < dos.length && remain > 0; j++) {
        var b = bakiDO[dos[j].doc_no];
        if (b <= 0) continue;
        var take = Math.min(b, remain);
        alloc.push({ doc_no: dos[j].doc_no, sen: take }); remain -= take;
      }
    }
    var allocSum = alloc.reduce(function (s, a) { return s + a.sen; }, 0);
    var overflow = amaunSen - allocSum;

    // deposit tulen (tiada hutang dibayar) → perlu Admin + sahkan
    if (allocSum === 0 && overflow > 0) {
      if (sess.role !== 'ADMIN') return _err('Ejen ini tiada hutang. Deposit kredit perlu kelulusan Admin.');
      if (!force) return { status: 'CONFIRM_DEPOSIT', message: 'Ejen tiada hutang. Simpan RM' + _rm(overflow) + ' sebagai deposit kredit?', amaun_rm: _rm(overflow) };
    }

    var now = _nowKL();
    var payNos = [], rows = [], statusBaru = [];
    alloc.forEach(function (a) {
      var pno = _nextDocNo('PAY'); payNos.push(pno);
      rows.push({
        pay_no: pno, tarikh: tarikh, ejen_id: ejenId, doc_no: a.doc_no, kaedah: kaedah,
        amaun_rm: _rm(a.sen), rujukan_resit: rujukan, sumber_doc: '', status: 'AKTIF',
        void_reason: '', void_by: '', void_at: '', catatan: catatan, client_ref: clientRef,
        created_by: sess.staff_id, created_at: now
      });
      var dRec = null; for (var k = 0; k < dos.length; k++) if (dos[k].doc_no === a.doc_no) dRec = dos[k];
      var newDibayar = (dRec ? dRec.dibayarSen : 0) + a.sen;
      var bersih = dRec ? dRec.bersihSen : 0;
      statusBaru.push({ doc_no: a.doc_no, status: _statusBayar(newDibayar, bersih), dibayar_rm: _rm(newDibayar), baki_rm: _rm(Math.max(0, bersih - newDibayar)) });
    });

    var lebihKredit = 0;
    if (overflow > 0) {
      var pnoK = _nextDocNo('PAY'); payNos.push(pnoK);
      rows.push({
        pay_no: pnoK, tarikh: tarikh, ejen_id: ejenId, doc_no: 'KREDIT', kaedah: kaedah,
        amaun_rm: _rm(overflow), rujukan_resit: rujukan, sumber_doc: '', status: 'AKTIF',
        void_reason: '', void_by: '', void_at: '', catatan: catatan || 'Lebihan bayaran → kredit',
        client_ref: clientRef, created_by: sess.staff_id, created_at: now
      });
      lebihKredit = overflow;
    }

    if (!rows.length) return _err('Tiada hutang untuk dibayar bagi ejen ini.');
    _appendRowsByHeader(SHEETS.PAYMENTS, rows);
    _audit(sess.staff_id, 'addPayment', payNos.join(','), ejenId + ' RM' + _rm(amaunSen) + ' ' + kaedah + (lebihKredit ? ' (+kredit RM' + _rm(lebihKredit) + ')' : ''));
    return _ok({
      pay_nos: payNos, status_baru: statusBaru, lebih_kredit_rm: _rm(lebihKredit),
      ejen_id: ejenId, ejen_nama: String(ejen.nama || ''), amaun_rm: _rm(amaunSen), kaedah: kaedah,
      bil_do: alloc.length
    });
  });
}

// ----- TULIS: batal bayaran (ADMIN) -----
function a_voidPayment(body) {
  var sess = body._sess;
  var payNo = String(body.pay_no || '').trim();
  var sebab = String(body.sebab || body.void_reason || '').trim();
  if (!payNo) return _err('pay_no diperlukan.');
  if (!sebab) return _err('Sila beri sebab pembatalan.');
  return _withLock(function () {
    var row = _findOne(SHEETS.PAYMENTS, function (p) { return String(p.pay_no) === payNo; });
    if (!row) return _err('Bayaran ' + payNo + ' tiada.');
    if (String(row.status).toUpperCase() === 'VOID') return _err('Bayaran sudah dibatalkan.');
    row.status = 'VOID'; row.void_reason = sebab; row.void_by = sess.staff_id; row.void_at = _nowKL();
    _updateRow(SHEETS.PAYMENTS, row.__row, row);
    _audit(sess.staff_id, 'voidPayment', payNo, sebab);
    return _ok({ pay_no: payNo, pay_status: 'VOID', doc_no: String(row.doc_no), ejen_id: String(row.ejen_id) });
  });
}

// ===================== M4b: TRANSFER / JUALAN OUTLET / RETURN / POS =====================
/** Validasi tarikh (KL): tak hadapan, backdate ≤ had_backdate_hari. Pulang mesej ralat atau null. */
function _validTarikh(tarikh, cfg) {
  var had = Number((cfg || _settingsMap()).had_backdate_hari || 7);
  var todayMs = new Date(_todayKL()).getTime();
  var t = new Date(tarikh).getTime();
  if (isNaN(t)) return 'Tarikh tidak sah.';
  if (t < todayMs - had * 86400000) return 'Tarikh melebihi had backdate ' + had + ' hari.';
  if (t > todayMs) return 'Tarikh tidak boleh hadapan.';
  return null;
}

/**
 * Agih pesanan keluaran (kumpul ikut SKU + FEFO dari `lokasi`). Dipakai Transfer & Jualan Outlet.
 * priceMode: 'NONE' (transfer, harga 0) | 'OUTLET' (harga_outlet_rm>0 else harga_runcit_rm).
 * Pulang {ok, perLine:[{sku,nama,qty,gift,harga_sen,line_sen,allocation}], subtotalSen, warnings, expiredSkipped} atau {ok:false,message}.
 */
function _allocateOrder(lines, baki, pMap, batchMap, cfg, lokasi, priceMode) {
  if (!lines || !lines.length) return { ok: false, message: 'Tiada produk.' };
  var benarkanExpiry = String(cfg.benarkan_jual_expiry || 'NO').toUpperCase() === 'YES';
  var alertHari = Number(cfg.tempoh_alert_expiry_hari || 90);
  var hariIni = _todayKL();
  var agg = {}, order = [];
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var skuI = String(l.sku || '').trim().toUpperCase();
    if (!skuI) return { ok: false, message: 'Baris ' + (i + 1) + ': SKU diperlukan.' };
    var qtyRaw = _num(l.qty), qtyI = Math.floor(qtyRaw);
    if (qtyI <= 0 || qtyI !== qtyRaw) return { ok: false, message: 'Baris ' + (i + 1) + ' (' + skuI + '): Kuantiti mesti integer > 0.' };
    if (!agg[skuI]) { agg[skuI] = { sku: skuI, qty: 0, gift: !!l.gift, harga: _num(l.harga) }; order.push(skuI); }
    agg[skuI].qty += qtyI;
    if (!l.gift) agg[skuI].gift = false;
    if (_num(l.harga) > 0) agg[skuI].harga = _num(l.harga); // override harga (jualan outlet)
  }
  var perLine = [], allWarnings = [], allExpired = [], subtotalSen = 0;
  var lokLabel = lokasi === 'WAREHOUSE' ? 'WH' : lokasi;
  for (var j = 0; j < order.length; j++) {
    var a0 = agg[order[j]], sku = a0.sku, qty = a0.qty;
    var p = pMap[sku];
    if (!p) return { ok: false, message: 'SKU "' + sku + '" tiada dalam master.' };
    if (String(p.aktif).toUpperCase() !== 'YES') return { ok: false, message: sku + ' tidak aktif.' };
    var isGift = a0.gift, hargaSen = 0;
    if (priceMode === 'OUTLET') {
      if (isGift) hargaSen = 0;
      else if (_num(a0.harga) > 0) hargaSen = _sen(a0.harga); // harga ditaip di kaunter (override)
      else { var ho = _sen(p.harga_outlet_rm), hr = _sen(p.harga_runcit_rm); hargaSen = ho > 0 ? ho : hr; } // default master
      if (!isGift && hargaSen <= 0) return { ok: false, message: sku + ' tiada harga — isi harga di borang jualan atau lengkapkan di Master.' };
    }
    var alloc = _allocateFIFO(baki, batchMap, sku, qty, lokasi, hariIni, benarkanExpiry, alertHari);
    if (alloc.shortfall > 0) {
      var msg = 'Stok ' + sku + ' tidak mencukupi di ' + lokLabel + '. Diminta ' + qty + ', ada ' + alloc.tersedia + '.';
      if (alloc.expiredSkipped.length) msg += ' (' + alloc.expiredSkipped.length + ' batch EXPIRED dilangkau.)';
      return { ok: false, message: msg };
    }
    var lineSen = qty * hargaSen; subtotalSen += lineSen;
    alloc.warnings.forEach(function (w) { allWarnings.push(w); });
    alloc.expiredSkipped.forEach(function (e) { e.sku = sku; allExpired.push(e); });
    perLine.push({ sku: sku, nama: String(p.nama || sku), qty: qty, gift: isGift, harga_sen: hargaSen, line_sen: lineSen, allocation: alloc.allocation });
  }
  return { ok: true, perLine: perLine, subtotalSen: subtotalSen, warnings: allWarnings, expiredSkipped: allExpired };
}

// ----- TRANSFER OUTLET (WH → outlet, ledger berpasangan) -----
function a_addTransfer(body) {
  var sess = body._sess;
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var outletId = String(body.outlet_id || '').trim().toUpperCase();
  var catatan = String(body.catatan || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines;
  if (!outletId) return _err('Sila pilih outlet.');
  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 produk diperlukan.');
  var cfg = _settingsMap();
  var derr = _validTarikh(tarikh, cfg); if (derr) return _err(derr);
  var outlet = _findOne(SHEETS.OUTLET, function (o) { return String(o.outlet_id) === outletId; });
  if (!outlet) return _err('Outlet "' + outletId + '" tiada dalam master.');
  if (String(outlet.aktif).toUpperCase() !== 'YES') return _err('Outlet "' + outletId + '" tidak aktif.');

  return _withLock(function () {
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), duplicate: true, mod: 'idempoten', outlet_id: outletId, outlet_nama: String(outlet.nama || '') });
    }
    var r = _allocateOrder(lines, _bakiMap(), _produkMap(), _batchMap(), cfg, 'WAREHOUSE', 'NONE');
    if (!r.ok) return _err(r.message);

    var now = _nowKL(), docNo = _nextDocNo('TRO'), docId = _uid('DH-');
    var ledgerRows = [], lineRows = [], allocOut = [];
    r.perLine.forEach(function (pl) {
      pl.allocation.forEach(function (a) {
        var kos = _rm(_sen(a.kos_seunit_rm));
        ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: 'TRF_OUTLET', sku: pl.sku, batch_id: a.batch_id, arah: -1, qty: -a.ambil, lokasi: 'WAREHOUSE', kos_seunit_rm: kos, pihak: outletId, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
        ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: 'TRF_OUTLET', sku: pl.sku, batch_id: a.batch_id, arah: 1, qty: a.ambil, lokasi: outletId, kos_seunit_rm: kos, pihak: 'WAREHOUSE', is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
      });
      lineRows.push({ line_id: _uid('LN-'), doc_id: docId, doc_no: docNo, sku: pl.sku, nama_produk: pl.nama, qty: pl.qty, harga_seunit_rm: 0, jumlah_rm: 0, disposisi: 'KELUAR', batch_id_rujukan: pl.allocation.length === 1 ? pl.allocation[0].batch_id : '', catatan_line: '' });
      allocOut.push({ sku: pl.sku, nama: pl.nama, qty: pl.qty, batches: pl.allocation });
    });

    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: 'TRF_OUTLET', subjenis: 'BIASA', tarikh: tarikh,
      pihak_jenis: 'OUTLET', pihak_id: outletId, lokasi_sasaran: outletId,
      subtotal_rm: 0, diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0, postage_rm: 0, jumlah_bersih_rm: 0,
      kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: '', status: 'AKTIF',
      void_reason: '', void_by: '', void_at: '', catatan: catatan, client_ref: clientRef, created_by: sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows);
    _audit(sess.staff_id, 'addTransfer', docNo, outletId + ' · ' + r.perLine.length + ' baris');
    return _ok({ doc_no: docNo, outlet_id: outletId, outlet_nama: String(outlet.nama || ''), tarikh: tarikh, catatan: catatan, allocation: allocOut });
  });
}

// ----- JUALAN OUTLET (FEFO atas stok outlet, LUNAS terus) -----
function a_addJualanOutlet(body) {
  var sess = body._sess;
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var staffOutlet = String(sess.outlet_id || '').trim().toUpperCase();
  var reqOutlet = String(body.outlet_id || '').trim().toUpperCase();
  if (staffOutlet && reqOutlet && reqOutlet !== staffOutlet) return _err('Anda hanya boleh jual untuk outlet ' + staffOutlet + '.');
  var outletId = staffOutlet || reqOutlet;
  var kaedah = String(body.kaedah || 'TUNAI').trim().toUpperCase();
  var catatan = String(body.catatan || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines;
  if (!outletId) return _err('Sila pilih outlet.');
  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 produk diperlukan.');
  var cfg = _settingsMap();
  var derr = _validTarikh(tarikh, cfg); if (derr) return _err(derr);
  var outlet = _findOne(SHEETS.OUTLET, function (o) { return String(o.outlet_id) === outletId; });
  if (!outlet) return _err('Outlet "' + outletId + '" tiada dalam master.');
  if (String(outlet.aktif).toUpperCase() !== 'YES') return _err('Outlet "' + outletId + '" tidak aktif.');

  return _withLock(function () {
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), duplicate: true, mod: 'idempoten', outlet_id: outletId, outlet_nama: String(outlet.nama || ''), jumlah_bersih_rm: _num(dup.jumlah_bersih_rm) });
    }
    var r = _allocateOrder(lines, _bakiMap(), _produkMap(), _batchMap(), cfg, outletId, 'OUTLET');
    if (!r.ok) return _err(r.message);

    // diskaun dokumen (opsyenal) — sen
    var diskaunJenis = String(body.diskaun_jenis || '-').toUpperCase();
    if (diskaunJenis === 'TIADA') diskaunJenis = '-';
    var diskaunInput = _num(body.diskaun_input), diskaunSen = 0;
    if (diskaunJenis === 'PERATUS') {
      if (diskaunInput < 0 || diskaunInput > 100) return _err('Peratus diskaun mesti 0–100.');
      diskaunSen = Math.round(r.subtotalSen * diskaunInput / 100);
    } else if (diskaunJenis === 'RM') { diskaunSen = _sen(diskaunInput); }
    if (diskaunSen < 0) return _err('Diskaun tidak boleh negatif.');
    if (diskaunSen > r.subtotalSen) return _err('Diskaun melebihi subtotal.');
    var jumlahSen = r.subtotalSen - diskaunSen;

    var now = _nowKL(), docNo = _nextDocNo('JLO'), docId = _uid('DH-');
    var ledgerRows = [], lineRows = [], allocOut = [];
    r.perLine.forEach(function (pl) {
      pl.allocation.forEach(function (a) {
        ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: 'JUAL_OUTLET', sku: pl.sku, batch_id: a.batch_id, arah: -1, qty: -a.ambil, lokasi: outletId, kos_seunit_rm: _rm(_sen(a.kos_seunit_rm)), pihak: 'WALK-IN', is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
      });
      lineRows.push({ line_id: _uid('LN-'), doc_id: docId, doc_no: docNo, sku: pl.sku, nama_produk: pl.nama, qty: pl.qty, harga_seunit_rm: _rm(pl.harga_sen), jumlah_rm: _rm(pl.line_sen), disposisi: 'KELUAR', batch_id_rujukan: pl.allocation.length === 1 ? pl.allocation[0].batch_id : '', catatan_line: pl.gift ? 'HADIAH' : '' });
      allocOut.push({ sku: pl.sku, nama: pl.nama, qty: pl.qty, batches: pl.allocation });
    });

    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: 'JUAL_OUTLET', subjenis: 'BIASA', tarikh: tarikh,
      pihak_jenis: 'OUTLET', pihak_id: outletId, lokasi_sasaran: outletId,
      subtotal_rm: _rm(r.subtotalSen), diskaun_jenis: diskaunJenis === '-' ? '' : diskaunJenis, diskaun_input: diskaunInput, diskaun_rm: _rm(diskaunSen),
      postage_rm: 0, jumlah_bersih_rm: _rm(jumlahSen), kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: '',
      status: 'AKTIF', void_reason: '', void_by: '', void_at: '', catatan: catatan + (kaedah ? ' [' + kaedah + ']' : ''), client_ref: clientRef, created_by: sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows);
    _audit(sess.staff_id, 'addJualanOutlet', docNo, outletId + ' · RM' + _rm(jumlahSen));
    return _ok({ doc_no: docNo, outlet_id: outletId, outlet_nama: String(outlet.nama || ''), tarikh: tarikh, subtotal_rm: _rm(r.subtotalSen), diskaun_rm: _rm(diskaunSen), jumlah_bersih_rm: _rm(jumlahSen), kaedah: kaedah, allocation: allocOut });
  });
}

// ----- RETURN / ROSAK (RTN_EJEN / RTN_OUTLET + KREDIT_RETURN) -----
function a_addReturn(body) {
  var sess = body._sess;
  var jenis = String(body.jenis || '').trim().toUpperCase(); // EJEN | OUTLET
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var pihakId = String(body.pihak_id || '').trim().toUpperCase();
  var docAsal = String(body.doc_no_asal || '').trim().toUpperCase();
  var beriKredit = body.beri_kredit !== false; // default YA
  var catatan = String(body.catatan || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines;
  if (jenis !== 'EJEN' && jenis !== 'OUTLET') return _err('Jenis return mesti EJEN atau OUTLET.');
  if (!pihakId) return _err('Sila pilih ' + (jenis === 'EJEN' ? 'ejen' : 'outlet') + '.');
  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 produk diperlukan.');
  var cfg = _settingsMap();
  var derr = _validTarikh(tarikh, cfg); if (derr) return _err(derr);
  if (jenis === 'EJEN') {
    if (!_findOne(SHEETS.EJEN, function (e) { return String(e.ejen_id) === pihakId; })) return _err('Ejen tiada dalam master.');
  } else {
    if (!_findOne(SHEETS.OUTLET, function (o) { return String(o.outlet_id) === pihakId; })) return _err('Outlet tiada dalam master.');
  }

  return _withLock(function () {
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), duplicate: true, mod: 'idempoten' });
    }
    var baki = _bakiMap(), batchMap = _batchMap(), pMap = _produkMap(), hariIni = _todayKL();

    // DO asal: qty & harga per sku (untuk cap + kredit). Tolak return AKTIF terdahulu.
    var asalQty = {}, asalHarga = {};
    if (docAsal) {
      _readSheet(SHEETS.DOC_LINES).forEach(function (ln) {
        if (String(ln.doc_no).toUpperCase() === docAsal) {
          var s = String(ln.sku).toUpperCase();
          asalQty[s] = (asalQty[s] || 0) + _num(ln.qty);
          asalHarga[s] = _sen(ln.harga_seunit_rm);
        }
      });
      // tolak qty yang sudah di-return (RTN AKTIF rujuk DO ini)
      var rtnHeaders = {};
      _readSheet(SHEETS.DOC_HEADER).forEach(function (h) {
        if ((String(h.doc_type) === 'RTN_EJEN' || String(h.doc_type) === 'RTN_OUTLET') &&
          String(h.rujukan_order_web).toUpperCase() === docAsal && String(h.status).toUpperCase() === 'AKTIF') {
          rtnHeaders[String(h.doc_no)] = true;
        }
      });
      _readSheet(SHEETS.DOC_LINES).forEach(function (ln) {
        if (rtnHeaders[String(ln.doc_no)]) {
          var s = String(ln.sku).toUpperCase();
          if (asalQty[s] !== undefined) asalQty[s] -= _num(ln.qty);
        }
      });
    }

    var now = _nowKL(), docNo = _nextDocNo('RTN'), docId = _uid('DH-');
    var ledgerRows = [], lineRows = [], retBySku = {}, usedOut = {}, creditSen = 0;
    var docType = jenis === 'EJEN' ? 'RTN_EJEN' : 'RTN_OUTLET';

    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var sku = String(l.sku || '').trim().toUpperCase();
      var qty = Math.floor(_num(l.qty));
      var disp = String(l.disposisi || '').trim().toUpperCase(); // RESTOCK | ROSAK
      var batchId = String(l.batch_id_rujukan || '').trim();
      var sebab = String(l.sebab || '').trim();
      if (!sku || !pMap[sku]) return _err('Baris ' + (i + 1) + ': SKU tidak sah.');
      if (qty <= 0) return _err('Baris ' + (i + 1) + ' (' + sku + '): Kuantiti mesti > 0.');
      if (disp !== 'RESTOCK' && disp !== 'ROSAK') return _err('Baris ' + (i + 1) + ': Tindakan mesti RESTOCK atau ROSAK.');
      if (!batchId) return _err('Baris ' + (i + 1) + ' (' + sku + '): Sila pilih batch.');
      var bt = batchMap[batchId];
      if (!bt || String(bt.sku).toUpperCase() !== sku) return _err('Baris ' + (i + 1) + ': Batch tidak sepadan dengan SKU.');
      if (disp === 'RESTOCK' && String(bt.ada_expiry).toUpperCase() === 'YES' && bt.expiry && String(bt.expiry) < hariIni) {
        return _err('Baris ' + (i + 1) + ' (' + sku + '): Batch sudah EXPIRED — guna HAPUS KIRA (ROSAK).');
      }
      var dest = disp === 'RESTOCK' ? 'WAREHOUSE' : 'ROSAK';
      var kos = _rm(_sen(bt.kos_seunit_rm));

      if (jenis === 'OUTLET') {
        var keyOut = sku + '|' + batchId;
        var bakiOut = (baki[sku] && baki[sku][pihakId] && baki[sku][pihakId][batchId]) ? baki[sku][pihakId][batchId].qty : 0;
        if ((usedOut[keyOut] || 0) + qty > bakiOut) return _err('Baris ' + (i + 1) + ' (' + sku + '): Outlet hanya ada ' + bakiOut + ' unit batch ini (termasuk baris lain).');
        usedOut[keyOut] = (usedOut[keyOut] || 0) + qty;
        ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: docType, sku: sku, batch_id: batchId, arah: -1, qty: -qty, lokasi: pihakId, kos_seunit_rm: kos, pihak: pihakId, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
      }
      ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: docType, sku: sku, batch_id: batchId, arah: 1, qty: qty, lokasi: dest, kos_seunit_rm: kos, pihak: pihakId, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
      lineRows.push({ line_id: _uid('LN-'), doc_id: docId, doc_no: docNo, sku: sku, nama_produk: String(pMap[sku].nama || sku), qty: qty, harga_seunit_rm: (docAsal && asalHarga[sku]) ? _rm(asalHarga[sku]) : 0, jumlah_rm: (docAsal && asalHarga[sku]) ? _rm(qty * asalHarga[sku]) : 0, disposisi: disp, batch_id_rujukan: batchId, catatan_line: sebab });
      retBySku[sku] = (retBySku[sku] || 0) + qty;
    }

    if (jenis === 'EJEN' && docAsal && beriKredit) {
      for (var s2 in retBySku) {
        if (asalQty[s2] === undefined) return _err('SKU ' + s2 + ' tiada dalam DO asal ' + docAsal + '.');
        if (retBySku[s2] > asalQty[s2]) return _err('Qty return ' + s2 + ' (' + retBySku[s2] + ') melebihi baki boleh-return DO asal (' + Math.max(0, asalQty[s2]) + ').');
        creditSen += retBySku[s2] * (asalHarga[s2] || 0);
      }
    }

    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: docType, subjenis: 'BIASA', tarikh: tarikh,
      pihak_jenis: jenis, pihak_id: pihakId, lokasi_sasaran: '',
      subtotal_rm: 0, diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0, postage_rm: 0, jumlah_bersih_rm: _rm(creditSen),
      kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: docAsal, status: 'AKTIF',
      void_reason: '', void_by: '', void_at: '', catatan: catatan, client_ref: clientRef, created_by: sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows);

    var nilaiKredit = 0;
    if (creditSen > 0) {
      var payNo = _nextDocNo('PAY');
      _appendRowsByHeader(SHEETS.PAYMENTS, [{
        pay_no: payNo, tarikh: tarikh, ejen_id: pihakId, doc_no: docAsal, kaedah: 'KREDIT_RETURN',
        amaun_rm: _rm(creditSen), rujukan_resit: '', sumber_doc: docNo, status: 'AKTIF',
        void_reason: '', void_by: '', void_at: '', catatan: 'Kredit return ' + docNo, client_ref: clientRef, created_by: sess.staff_id, created_at: now
      }]);
      nilaiKredit = creditSen;
    }
    _audit(sess.staff_id, 'addReturn', docNo, jenis + ' ' + pihakId + (nilaiKredit ? ' kredit RM' + _rm(nilaiKredit) : ''));

    var hutangBaru = null;
    if (jenis === 'EJEN') {
      var hutangSen = 0;
      _dosEjen(pihakId, _payAgg()).forEach(function (d) { hutangSen += Math.max(0, d.bakiSen); });
      hutangBaru = _rm(hutangSen);
    }
    return _ok({ doc_no: docNo, jenis: jenis, pihak_id: pihakId, nilai_kredit_rm: _rm(nilaiKredit), doc_no_asal: docAsal, hutang_baru_rm: hutangBaru });
  });
}

// ----- LUPUS (write-off dari ROSAK sahaja) -----
function a_addLupus(body) {
  var sess = body._sess;
  var tarikh = String(body.tarikh || _todayKL()).trim();
  var sebab = String(body.sebab || '').trim();
  var clientRef = String(body.client_ref || '');
  var lines = body.lines; // {sku, batch_id, qty}
  if (!Array.isArray(lines) || !lines.length) return _err('Sekurang-kurangnya 1 baris diperlukan.');
  if (!sebab) return _err('Sila beri sebab pelupusan.');
  var cfg = _settingsMap();
  var derr = _validTarikh(tarikh, cfg); if (derr) return _err(derr);
  return _withLock(function () {
    if (clientRef) {
      var dup = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.client_ref) === clientRef; });
      if (dup) return _ok({ doc_no: String(dup.doc_no), duplicate: true, mod: 'idempoten' });
    }
    var baki = _bakiMap(), batchMap = _batchMap(), pMap = _produkMap();
    var now = _nowKL(), docNo = _nextDocNo('LPS'), docId = _uid('DH-');
    var ledgerRows = [], lineRows = [], used = {};
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var sku = String(l.sku || '').trim().toUpperCase();
      var batchId = String(l.batch_id || '').trim();
      var qty = Math.floor(_num(l.qty));
      if (!sku || !pMap[sku]) return _err('Baris ' + (i + 1) + ': SKU tidak sah.');
      if (!batchId) return _err('Baris ' + (i + 1) + ': batch diperlukan.');
      if (qty <= 0) return _err('Baris ' + (i + 1) + ': Kuantiti mesti > 0.');
      var keyL = sku + '|' + batchId;
      var bakiRosak = (baki[sku] && baki[sku]['ROSAK'] && baki[sku]['ROSAK'][batchId]) ? baki[sku]['ROSAK'][batchId].qty : 0;
      var availL = bakiRosak - (used[keyL] || 0);
      if (qty > availL) return _err('Baris ' + (i + 1) + ' (' + sku + '): ROSAK hanya ada ' + availL + ' unit batch ini (selepas baris terdahulu).');
      used[keyL] = (used[keyL] || 0) + qty;
      var bt = batchMap[batchId] || {};
      ledgerRows.push({ ledger_id: _uid('L-'), created_at: now, tarikh_efektif: tarikh, doc_no: docNo, doc_type: 'LUPUS', sku: sku, batch_id: batchId, arah: -1, qty: -qty, lokasi: 'ROSAK', kos_seunit_rm: _rm(_sen(bt.kos_seunit_rm)), pihak: '', is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id });
      lineRows.push({ line_id: _uid('LN-'), doc_id: docId, doc_no: docNo, sku: sku, nama_produk: String(pMap[sku].nama || sku), qty: qty, harga_seunit_rm: 0, jumlah_rm: 0, disposisi: 'KELUAR', batch_id_rujukan: batchId, catatan_line: sebab });
    }
    _appendRowsByHeader(SHEETS.DOC_HEADER, [{
      doc_id: docId, doc_no: docNo, doc_type: 'LUPUS', subjenis: 'BIASA', tarikh: tarikh,
      pihak_jenis: '-', pihak_id: '', lokasi_sasaran: 'ROSAK',
      subtotal_rm: 0, diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0, postage_rm: 0, jumlah_bersih_rm: 0,
      kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: '', status: 'AKTIF',
      void_reason: '', void_by: '', void_at: '', catatan: sebab, client_ref: clientRef, created_by: sess.staff_id, created_at: now
    }]);
    _appendRowsByHeader(SHEETS.DOC_LINES, lineRows);
    _appendRowsByHeader(SHEETS.LEDGER, ledgerRows);
    _audit(sess.staff_id, 'addLupus', docNo, lines.length + ' baris · ' + sebab);
    return _ok({ doc_no: docNo, bilangan_baris: lines.length });
  });
}

// ----- POS & AWB -----
function a_addPostage(body) {
  var sess = body._sess;
  var doNo = String(body.do_no || '').trim().toUpperCase();
  var kurier = String(body.kurier || '').trim().toUpperCase();
  var noTracking = String(body.no_tracking || '').trim();
  var beratKg = _num(body.berat_kg);
  var casKos = _num(body.cas_kos_rm);
  if (!doNo) return _err('do_no diperlukan.');
  if (beratKg <= 0) return _err('Berat (kg) mesti > 0.');
  return _withLock(function () {
    var doc = _findOne(SHEETS.DOC_HEADER, function (r) { return String(r.doc_no) === doNo; });
    if (!doc) return _err('DO ' + doNo + ' tiada.');
    if (String(doc.doc_type) !== 'DO_EJEN') return _err('Dokumen ' + doNo + ' bukan DO ejen.');
    if (String(doc.status).toUpperCase() !== 'AKTIF') return _err('DO ' + doNo + ' bukan AKTIF.');
    var now = _nowKL(), posId = _nextDocNo('POS');
    _appendRowsByHeader(SHEETS.POSTAGE, [{ pos_id: posId, do_no: doNo, kurier: kurier, no_tracking: noTracking, berat_kg: beratKg, cas_kos_rm: _rm(_sen(casKos)), created_by: sess.staff_id, created_at: now }]);
    _audit(sess.staff_id, 'addPostage', posId, doNo + ' ' + kurier + ' ' + noTracking);
    return _ok({ pos_id: posId, do_no: doNo, kurier: kurier, no_tracking: noTracking });
  });
}

function a_getBatches() {
  var out = _readSheet(SHEETS.BATCH).map(function (b) {
    return { batch_id: b.batch_id, sku: String(b.sku).toUpperCase(), batch_no: b.batch_no, expiry: String(b.expiry || ''), ada_expiry: String(b.ada_expiry || 'TIDAK').toUpperCase() };
  });
  return _ok({ batches: out });
}

function a_getPosHariIni() {
  var headers = _readSheet(SHEETS.DOC_HEADER).filter(function (h) {
    return String(h.doc_type) === 'DO_EJEN' && String(h.status).toUpperCase() === 'AKTIF';
  });
  var posDone = {};
  _readSheet(SHEETS.POSTAGE).forEach(function (p) { var t = String(p.no_tracking || '').trim(); if (t) posDone[String(p.do_no)] = t; });
  var ejenMap = {};
  _readSheet(SHEETS.EJEN).forEach(function (e) { ejenMap[String(e.ejen_id).toUpperCase()] = e; });
  var pBerat = {};
  _readSheet(SHEETS.PRODUK).forEach(function (p) { pBerat[String(p.sku).toUpperCase()] = _num(p.berat_gram); });
  var beratMap = {};
  _readSheet(SHEETS.DOC_LINES).forEach(function (ln) {
    var dn = String(ln.doc_no);
    beratMap[dn] = (beratMap[dn] || 0) + _num(ln.qty) * (pBerat[String(ln.sku).toUpperCase()] || 0);
  });
  var belum = [], dah = [];
  headers.forEach(function (h) {
    var dn = String(h.doc_no);
    var ej = ejenMap[String(h.pihak_id).toUpperCase()] || {};
    var tracking = posDone[dn] || String(h.no_tracking || '').trim();
    var row = {
      do_no: dn, tarikh: String(h.tarikh), ejen: String(ej.nama || h.pihak_id),
      alamat: String(ej.kawasan || ''), no_tel: String(ej.no_tel || ''),
      berat_anggar: Math.round(beratMap[dn] || 0) / 1000, jumlah_rm: _num(h.jumlah_bersih_rm), no_tracking: tracking
    };
    if (tracking) dah.push(row); else belum.push(row);
  });
  belum.sort(function (a, b) { return a.tarikh < b.tarikh ? -1 : 1; });
  dah.sort(function (a, b) { return a.tarikh < b.tarikh ? 1 : -1; });
  return _ok({ belumPos: belum, dahPos: dah });
}

// ===================== M5: DOKUMEN / VOID / INTEGRITI / KIRAAN STOK =====================
var DOC_TYPE_LABEL = {
  GRN: 'Stok Masuk', DO_EJEN: 'DO Ejen', TRF_OUTLET: 'Transfer Outlet',
  JUAL_OUTLET: 'Jualan Outlet', RTN_EJEN: 'Return Ejen', RTN_OUTLET: 'Return Outlet',
  ADJ: 'Pelarasan', LUPUS: 'Lupus'
};

// ----- SENARAI DOKUMEN (S11) -----
function a_getDocList(body) {
  var fJenis = String(body.doc_type || '').trim().toUpperCase();
  var fStatus = String(body.status || '').trim().toUpperCase();
  var fPihak = String(body.pihak_id || '').trim().toUpperCase();
  var fCari = String(body.cari || '').trim().toUpperCase();
  var dari = String(body.dari || '').trim(), hingga = String(body.hingga || '').trim();
  var agg = _payAgg();
  var rows = _readSheet(SHEETS.DOC_HEADER).filter(function (h) {
    if (fJenis && String(h.doc_type) !== fJenis) return false;
    if (fStatus && String(h.status).toUpperCase() !== fStatus) return false;
    if (fPihak && String(h.pihak_id).toUpperCase().indexOf(fPihak) === -1) return false;
    if (fCari && String(h.doc_no).toUpperCase().indexOf(fCari) === -1 &&
      String(h.pihak_id).toUpperCase().indexOf(fCari) === -1) return false;
    var t = String(h.tarikh);
    if (dari && t < dari) return false;
    if (hingga && t > hingga) return false;
    return true;
  }).map(function (h) {
    var o = {
      doc_no: String(h.doc_no), doc_type: String(h.doc_type),
      label: DOC_TYPE_LABEL[String(h.doc_type)] || String(h.doc_type),
      tarikh: String(h.tarikh), pihak_id: String(h.pihak_id),
      jumlah_rm: _num(h.jumlah_bersih_rm), status: String(h.status).toUpperCase(),
      created_at: String(h.created_at), created_by: String(h.created_by)
    };
    if (o.doc_type === 'DO_EJEN' && o.status === 'AKTIF') {
      o.status_bayaran = _statusBayar(agg.dibayar[o.doc_no] || 0, _sen(h.jumlah_bersih_rm));
    }
    return o;
  });
  rows.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }); // terbaru dulu
  return _ok({ docs: rows.slice(0, 100), jumlah_rekod: rows.length });
}

/**
 * Pre-check VOID (§4.8) — dikongsi getDocDetail (papar) & voidDoc (dalam lock).
 * Pulang {boleh:false, sebab} atau {boleh:true, orig:[baris ledger asal bukan-reversal]}.
 */
function _voidPreCheck(doc, sess, cfg, baki, ledgerDoc, payments, headers) {
  var st = String(doc.status).toUpperCase();
  if (st !== 'AKTIF') return { boleh: false, sebab: 'Dokumen bukan AKTIF (status: ' + st + ').' };
  var dt = String(doc.doc_type);
  if (!DOC_TYPE_LABEL[dt]) return { boleh: false, sebab: 'Jenis dokumen ini tidak boleh di-void.' };
  var docNo = String(doc.doc_no).toUpperCase();

  // bayaran AKTIF berkait
  var payAktif = payments.filter(function (p) {
    return String(p.status).toUpperCase() === 'AKTIF' && String(p.doc_no).toUpperCase() === docNo;
  });

  // role: ADMIN bebas; WAREHOUSE bersyarat (§7)
  if (sess.role !== 'ADMIN') {
    if (String(cfg.void_warehouse_hari_sama || 'YES').toUpperCase() !== 'YES')
      return { boleh: false, sebab: 'VOID hanya untuk Admin. Sila maklumkan Admin.' };
    if (String(doc.created_by) !== sess.staff_id)
      return { boleh: false, sebab: 'Anda hanya boleh void dokumen yang anda cipta sendiri. Sila maklumkan Admin.' };
    if (String(doc.created_at).slice(0, 10) !== _todayKL())
      return { boleh: false, sebab: 'Dokumen bukan hari ini. Sila maklumkan Admin untuk void.' };
    if (payAktif.length)
      return { boleh: false, sebab: 'Dokumen ada bayaran berkait. Sila maklumkan Admin.' };
  }

  if (dt === 'DO_EJEN') {
    // d. bayaran tunai/transfer/cheque mesti di-void dulu
    var tunai = payAktif.filter(function (p) { return String(p.kaedah).toUpperCase() !== 'KREDIT_RETURN'; });
    if (tunai.length) return { boleh: false, sebab: 'Void bayaran ' + tunai.map(function (p) { return String(p.pay_no); }).join(', ') + ' dahulu.' };
    var kr = payAktif.filter(function (p) { return String(p.kaedah).toUpperCase() === 'KREDIT_RETURN'; });
    if (kr.length) return { boleh: false, sebab: 'Ada kredit return atas DO ini — void return ' + kr.map(function (p) { return String(p.sumber_doc || p.pay_no); }).join(', ') + ' dahulu.' };
    // return AKTIF yang merujuk DO ini (walau tanpa kredit) mesti di-void dulu
    var rtnAktif = headers.filter(function (h) {
      return (String(h.doc_type) === 'RTN_EJEN' || String(h.doc_type) === 'RTN_OUTLET') &&
        String(h.rujukan_order_web).toUpperCase() === docNo && String(h.status).toUpperCase() === 'AKTIF';
    });
    if (rtnAktif.length) return { boleh: false, sebab: 'Void return ' + rtnAktif.map(function (h) { return String(h.doc_no); }).join(', ') + ' dahulu.' };
  }

  // baris ledger asal (bukan reversal)
  var orig = ledgerDoc.filter(function (r) { return String(r.is_reversal).toUpperCase() !== 'YES'; });

  // simulasi reversal: baki setiap (sku,lokasi,batch) terjejas mesti kekal >= 0
  var deltas = {};
  orig.forEach(function (r) {
    var k = String(r.sku) + '|' + String(r.lokasi) + '|' + String(r.batch_id);
    deltas[k] = (deltas[k] || 0) - _num(r.qty);
  });
  for (var k in deltas) {
    var p3 = k.split('|');
    var cur = (baki[p3[0]] && baki[p3[0]][p3[1]] && baki[p3[0]][p3[1]][p3[2]]) ? _num(baki[p3[0]][p3[1]][p3[2]].qty) : 0;
    if (cur + deltas[k] < 0) {
      var kurang = -(cur + deltas[k]);
      var sebab;
      if (dt === 'GRN') sebab = 'Batch ' + p3[2] + ' (' + p3[0] + ') sudah digunakan dalam dokumen lain (kurang ' + kurang + ' unit). Guna Pelarasan (ADJ) melalui Kiraan Stok.';
      else if (dt === 'TRF_OUTLET') sebab = 'Stok ' + p3[0] + ' di ' + p3[1] + ' tidak cukup untuk tarik balik (kurang ' + kurang + ' unit — mungkin sudah terjual). Guna Pelarasan (ADJ).';
      else sebab = 'Baki ' + p3[0] + ' @ ' + p3[1] + ' akan jadi negatif (' + (cur + deltas[k]) + ') selepas void. Semak dokumen berkait dahulu.';
      return { boleh: false, sebab: sebab };
    }
  }
  return { boleh: true, orig: orig };
}

// ----- DETAIL DOKUMEN + pre-check void -----
function a_getDocDetail(body) {
  var sess = body._sess;
  var docNo = String(body.doc_no || '').trim().toUpperCase();
  if (!docNo) return _err('doc_no diperlukan.');
  var headers = _readSheet(SHEETS.DOC_HEADER);
  var doc = null;
  headers.forEach(function (h) { if (String(h.doc_no).toUpperCase() === docNo) doc = h; });
  if (!doc) return _err('Dokumen ' + docNo + ' tiada.');

  var lines = _readSheet(SHEETS.DOC_LINES).filter(function (l) { return String(l.doc_no).toUpperCase() === docNo; });
  var ledgerDoc = _readSheet(SHEETS.LEDGER).filter(function (r) { return String(r.doc_no).toUpperCase() === docNo; });
  var payments = _readSheet(SHEETS.PAYMENTS);
  var payDoc = payments.filter(function (p) {
    return String(p.doc_no).toUpperCase() === docNo || String(p.sumber_doc).toUpperCase() === docNo;
  });
  var postage = _readSheet(SHEETS.POSTAGE).filter(function (p) { return String(p.do_no).toUpperCase() === docNo; });
  var audit = _readSheet(SHEETS.AUDIT).filter(function (a) { return String(a.ref).toUpperCase().indexOf(docNo) !== -1; }).slice(-20);

  var chk = _voidPreCheck(doc, sess, _settingsMap(), _bakiMap(), ledgerDoc, payments, headers);

  return _ok({
    header: {
      doc_no: String(doc.doc_no), doc_type: String(doc.doc_type),
      label: DOC_TYPE_LABEL[String(doc.doc_type)] || String(doc.doc_type),
      subjenis: String(doc.subjenis || ''), tarikh: String(doc.tarikh),
      pihak_jenis: String(doc.pihak_jenis || ''), pihak_id: String(doc.pihak_id || ''),
      subtotal_rm: _num(doc.subtotal_rm), diskaun_rm: _num(doc.diskaun_rm),
      postage_rm: _num(doc.postage_rm), jumlah_bersih_rm: _num(doc.jumlah_bersih_rm),
      status: String(doc.status).toUpperCase(), void_reason: String(doc.void_reason || ''),
      void_by: String(doc.void_by || ''), void_at: String(doc.void_at || ''),
      catatan: String(doc.catatan || ''), created_by: String(doc.created_by), created_at: String(doc.created_at)
    },
    lines: lines.map(function (l) {
      return { sku: String(l.sku), nama: String(l.nama_produk), qty: _num(l.qty), harga_seunit_rm: _num(l.harga_seunit_rm), jumlah_rm: _num(l.jumlah_rm), disposisi: String(l.disposisi || ''), catatan_line: String(l.catatan_line || '') };
    }),
    ledger: ledgerDoc.map(function (r) {
      return { ledger_id: String(r.ledger_id), tarikh_efektif: String(r.tarikh_efektif), sku: String(r.sku), batch_id: String(r.batch_id), qty: _num(r.qty), lokasi: String(r.lokasi), is_reversal: String(r.is_reversal).toUpperCase() === 'YES', reversal_of: String(r.reversal_of || '') };
    }),
    payments: payDoc.map(function (p) {
      return { pay_no: String(p.pay_no), tarikh: String(p.tarikh), kaedah: String(p.kaedah), amaun_rm: _num(p.amaun_rm), status: String(p.status).toUpperCase(), sumber_doc: String(p.sumber_doc || '') };
    }),
    postage: postage.map(function (p) {
      return { pos_id: String(p.pos_id), kurier: String(p.kurier), no_tracking: String(p.no_tracking), berat_kg: _num(p.berat_kg), created_at: String(p.created_at) };
    }),
    audit: audit.map(function (a) {
      return { masa: String(a.created_at), staff_id: String(a.staff_id), action: String(a.action), detail: String(a.detail) };
    }),
    boleh_void: chk.boleh, sebab_tak_boleh: chk.boleh ? '' : chk.sebab
  });
}

// ----- VOID DOKUMEN (§4.8 + P4a: VOIDING transient → reversal → VOID) -----
function a_voidDoc(body) {
  var sess = body._sess;
  var docNo = String(body.doc_no || '').trim().toUpperCase();
  var sebab = String(body.sebab || body.void_reason || '').trim();
  if (!docNo) return _err('doc_no diperlukan.');
  if (sebab.length < 5) return _err('Sebab void mesti sekurang-kurangnya 5 aksara.');
  var cfg = _settingsMap();

  return _withLock(function () {
    var headers = _readSheet(SHEETS.DOC_HEADER);
    var doc = null;
    headers.forEach(function (h) { if (String(h.doc_no).toUpperCase() === docNo) doc = h; });
    if (!doc) return _err('Dokumen ' + docNo + ' tiada.');

    var ledgerAll = _readSheet(SHEETS.LEDGER);
    var ledgerDoc = ledgerAll.filter(function (r) { return String(r.doc_no).toUpperCase() === docNo; });
    var payments = _readSheet(SHEETS.PAYMENTS);
    // baki dari bacaan ledger yang sama (konsisten dalam lock)
    var baki = {};
    ledgerAll.forEach(function (r) {
      var sku = String(r.sku || ''), lok = String(r.lokasi || ''), bid = String(r.batch_id || '');
      if (!sku || !lok || !bid) return;
      if (!baki[sku]) baki[sku] = {};
      if (!baki[sku][lok]) baki[sku][lok] = {};
      if (!baki[sku][lok][bid]) baki[sku][lok][bid] = { qty: 0 };
      baki[sku][lok][bid].qty += _num(r.qty);
    });

    var chk = _voidPreCheck(doc, sess, cfg, baki, ledgerDoc, payments, headers);
    if (!chk.boleh) return _err(chk.sebab);

    var now = _nowKL(), hariIni = _todayKL();

    // 1. status transient VOIDING (P4a — partial-write selamat, I4 tangkap jika tersangkut)
    doc.status = 'VOIDING';
    _updateRow(SHEETS.DOC_HEADER, doc.__row, doc);

    // 2. append reversal LEDGER (arah berlawanan, batch/lokasi sama)
    var revRows = chk.orig.map(function (r) {
      return {
        ledger_id: _uid('L-'), created_at: now, tarikh_efektif: hariIni,
        doc_no: String(doc.doc_no), doc_type: String(r.doc_type),
        sku: String(r.sku), batch_id: String(r.batch_id),
        arah: -_num(r.arah), qty: -_num(r.qty),
        lokasi: String(r.lokasi), kos_seunit_rm: _num(r.kos_seunit_rm),
        pihak: String(r.pihak || ''), is_reversal: 'YES', reversal_of: String(r.ledger_id),
        created_by: sess.staff_id
      };
    });
    if (revRows.length) _appendRowsByHeader(SHEETS.LEDGER, revRows);
    SpreadsheetApp.flush();

    // 3. muktamadkan VOID
    doc.status = 'VOID'; doc.void_reason = sebab; doc.void_by = sess.staff_id; doc.void_at = now;
    _updateRow(SHEETS.DOC_HEADER, doc.__row, doc);

    // 4. RTN_EJEN: void KREDIT_RETURN yang dijananya (§4.8g — dalam lock sama)
    var voidedPays = [];
    if (String(doc.doc_type) === 'RTN_EJEN') {
      payments.forEach(function (p) {
        if (String(p.sumber_doc).toUpperCase() === docNo && String(p.status).toUpperCase() === 'AKTIF' &&
          String(p.kaedah).toUpperCase() === 'KREDIT_RETURN') {
          p.status = 'VOID'; p.void_reason = 'Auto: void ' + docNo; p.void_by = sess.staff_id; p.void_at = now;
          _updateRow(SHEETS.PAYMENTS, p.__row, p);
          voidedPays.push(String(p.pay_no));
        }
      });
    }

    _audit(sess.staff_id, 'voidDoc', docNo, sebab + ' · ' + revRows.length + ' reversal' + (voidedPays.length ? ' · void kredit ' + voidedPays.join(',') : ''));
    return _ok({ doc_no: docNo, doc_status: 'VOID', bil_reversal: revRows.length, payments_void: voidedPays });
  });
}

// ----- INTEGRITY CHECKER I1–I9 (§4.16) -----
function a_semakIntegriti(body) {
  return _withLock(function () { return _runIntegriti(body._sess.staff_id); });
}

/** Jalankan 9 invariant. PANGGIL DALAM LOCK (baca keadaan konsisten). */
function _runIntegriti(by) {
  var anomali = [];
  function add(kod, tahap, mesej) { anomali.push({ kod: kod, tahap: tahap, mesej: mesej }); }

  var ledger = _readSheet(SHEETS.LEDGER);
  var headers = _readSheet(SHEETS.DOC_HEADER);
  var lines = _readSheet(SHEETS.DOC_LINES);
  var pays = _readSheet(SHEETS.PAYMENTS);
  var hMap = {};
  headers.forEach(function (h) { hMap[String(h.doc_no).toUpperCase()] = h; });

  // I1: baki >= 0 per (sku,lokasi,batch)
  var baki = {};
  ledger.forEach(function (r) {
    var k = String(r.sku) + ' @ ' + String(r.lokasi) + ' batch ' + String(r.batch_id);
    baki[k] = (baki[k] || 0) + _num(r.qty);
  });
  Object.keys(baki).forEach(function (k) {
    if (baki[k] < 0) add('I1', 'KRITIKAL', 'Baki NEGATIF: ' + k + ' = ' + baki[k]);
  });

  // I2: setiap baris ledger ada header
  ledger.forEach(function (r) {
    if (!hMap[String(r.doc_no).toUpperCase()]) add('I2', 'KRITIKAL', 'Ledger orphan ' + r.ledger_id + ' — doc ' + r.doc_no + ' tiada dalam DOC_HEADER.');
  });

  // I3: doc bukan-VOID berstok → ada lines & Σ ledger (bukan reversal) padan Σ lines per sku
  var STOK_TYPES = { GRN: 1, DO_EJEN: 1, TRF_OUTLET: 1, JUAL_OUTLET: 1, RTN_EJEN: 1, RTN_OUTLET: 1, ADJ: 1, LUPUS: 1 };
  var linesByDoc = {};
  lines.forEach(function (ln) {
    var d = String(ln.doc_no).toUpperCase(), s = String(ln.sku).toUpperCase();
    if (!linesByDoc[d]) linesByDoc[d] = {};
    linesByDoc[d][s] = (linesByDoc[d][s] || 0) + _num(ln.qty);
  });
  var ledByDoc = {}, byDocAll = {};
  ledger.forEach(function (r) {
    var d = String(r.doc_no).toUpperCase();
    (byDocAll[d] = byDocAll[d] || []).push(r);
    if (String(r.is_reversal).toUpperCase() === 'YES') return;
    var s = String(r.sku).toUpperCase();
    if (!ledByDoc[d]) ledByDoc[d] = {};
    if (!ledByDoc[d][s]) ledByDoc[d][s] = { masuk: 0, keluar: 0 };
    var q = _num(r.qty);
    if (q > 0) ledByDoc[d][s].masuk += q; else ledByDoc[d][s].keluar += -q;
  });
  headers.forEach(function (h) {
    var dt = String(h.doc_type), st = String(h.status).toUpperCase(), dn = String(h.doc_no).toUpperCase();
    if (!STOK_TYPES[dt] || st === 'VOID' || st === 'VOIDING') return; // VOIDING → I4
    var lset = linesByDoc[dn];
    if (!lset) { add('I3', 'AMARAN', dn + ': header tanpa DOC_LINES (partial write?) — void & buat semula.'); return; }
    var led = ledByDoc[dn] || {};
    Object.keys(lset).forEach(function (s) {
      var exp = lset[s];
      // ADJ: qty bertanda boleh campur +/− atas SKU sama (batch lain) → jumlah pergerakan = masuk+keluar.
      // Jenis lain: GRN/RTN_EJEN masuk sahaja, DO/JLO/LUPUS keluar sahaja, TRF/RTN_OUTLET berpasangan (masuk==keluar) → max.
      var got = led[s] ? (dt === 'ADJ' ? led[s].masuk + led[s].keluar : Math.max(led[s].masuk, led[s].keluar)) : 0;
      if (got !== exp) add('I3', got === 0 ? 'AMARAN' : 'KRITIKAL',
        dn + ' (' + s + '): lines=' + exp + ' vs ledger=' + got + (got === 0 ? ' — dokumen tergantung (tiada kesan stok); void & buat semula.' : ' — qty tak padan.'));
    });
    Object.keys(led).forEach(function (s) {
      if (lset[s] === undefined) add('I3', 'KRITIKAL', dn + ' (' + s + '): ada pergerakan ledger tanpa baris dokumen.');
    });
  });

  // I4: VOID lengkap; tiada VOIDING tersangkut; tiada reversal pada header AKTIF
  headers.forEach(function (h) {
    var st = String(h.status).toUpperCase(), dn = String(h.doc_no).toUpperCase();
    var rows = byDocAll[dn] || [];
    if (st === 'VOIDING') { add('I4', 'KRITIKAL', dn + ' tersangkut status VOIDING — void semula untuk lengkapkan.'); return; }
    var revOf = {};
    rows.forEach(function (r) { if (String(r.is_reversal).toUpperCase() === 'YES') revOf[String(r.reversal_of)] = true; });
    if (st === 'VOID') {
      rows.forEach(function (r) {
        if (String(r.is_reversal).toUpperCase() === 'YES') return;
        if (!revOf[String(r.ledger_id)]) add('I4', 'KRITIKAL', 'VOID tak lengkap: ' + dn + ' baris ' + r.ledger_id + ' tiada pasangan reversal.');
      });
    } else if (rows.some(function (r) { return String(r.is_reversal).toUpperCase() === 'YES'; })) {
      add('I4', 'KRITIKAL', dn + ': ada baris reversal tetapi header masih ' + st + '.');
    }
  });

  // I5: TRF seimbang — Σ qty bertanda per (sku,batch) = 0 (termasuk reversal)
  headers.forEach(function (h) {
    if (String(h.doc_type) !== 'TRF_OUTLET') return;
    var dn = String(h.doc_no).toUpperCase(), sums = {};
    (byDocAll[dn] || []).forEach(function (r) {
      var k = String(r.sku).toUpperCase() + ' batch ' + String(r.batch_id);
      sums[k] = (sums[k] || 0) + _num(r.qty);
    });
    Object.keys(sums).forEach(function (k) {
      if (sums[k] !== 0) add('I5', 'KRITIKAL', 'Transfer pincang ' + dn + ' (' + k + '): Σ=' + sums[k] + ' (patut 0).');
    });
  });

  // I6: dibayar <= bersih per DO AKTIF; tiada bayaran AKTIF atas doc VOID/tak wujud
  var dib = {};
  pays.forEach(function (p) {
    if (String(p.status).toUpperCase() !== 'AKTIF') return;
    var d = String(p.doc_no).toUpperCase();
    if (d === 'KREDIT') return;
    dib[d] = (dib[d] || 0) + _sen(p.amaun_rm);
    if (!hMap[d]) add('I6', 'KRITIKAL', 'Bayaran ' + p.pay_no + ' atas dokumen tidak wujud: ' + d);
  });
  headers.forEach(function (h) {
    if (String(h.doc_type) !== 'DO_EJEN') return;
    var dn = String(h.doc_no).toUpperCase(), st = String(h.status).toUpperCase();
    var d = dib[dn] || 0;
    if (st === 'AKTIF' && d > _sen(h.jumlah_bersih_rm)) add('I6', 'AMARAN', 'DO ' + dn + ' TERLEBIH bayar: RM' + _rm(d) + ' vs jumlah RM' + _num(h.jumlah_bersih_rm) + '.');
    if (st === 'VOID' && d > 0) add('I6', 'KRITIKAL', 'Bayaran AKTIF RM' + _rm(d) + ' atas DO VOID ' + dn + ' — void/realokasi bayaran itu.');
  });

  // I7: doc_no & pay_no unik; counter Properties >= max siri dalam sheet
  var props = PropertiesService.getScriptProperties();
  var seen = {};
  headers.forEach(function (h) { var dn = String(h.doc_no).toUpperCase(); if (seen[dn]) add('I7', 'KRITIKAL', 'doc_no PENDUA: ' + dn); seen[dn] = 1; });
  var seenPay = {};
  pays.forEach(function (p) { var pn = String(p.pay_no); if (seenPay[pn]) add('I7', 'KRITIKAL', 'pay_no PENDUA: ' + pn); seenPay[pn] = 1; });
  var maxBy = {};
  function trackMax(no) { var m = String(no).match(/^([A-Z]+)-?(\d+)$/); if (m) maxBy[m[1]] = Math.max(maxBy[m[1]] || 0, Number(m[2])); }
  headers.forEach(function (h) { trackMax(h.doc_no); });
  pays.forEach(function (p) { trackMax(p.pay_no); });
  Object.keys(maxBy).forEach(function (pfx) {
    var cur = Number(props.getProperty('seq_' + pfx) || 0);
    if (cur < maxBy[pfx]) add('I7', 'KRITIKAL', 'Counter seq_' + pfx + ' (' + cur + ') < max dalam sheet (' + maxBy[pfx] + ') — jalankan Rebuild Counters SEGERA.');
  });

  // I8: snapshot+delta vs kiraan penuh (snapshot belum aktif Fasa 1 → dilangkau)
  var cfg = _settingsMap();
  var i8Skip = String(cfg.snapshot_aktif || 'NO').toUpperCase() !== 'YES';

  // I9: ledger tidak mengecil (checksum baris) + KREDIT_RETURN sumbernya VOID
  var lastCount = Number(props.getProperty('chk_ledger_rows') || 0);
  if (ledger.length < lastCount) add('I9', 'KRITIKAL', 'LEDGER MENGECIL: ' + lastCount + ' → ' + ledger.length + ' baris — baris dipadam secara manual? Pulihkan dari backup.');
  props.setProperty('chk_ledger_rows', String(ledger.length));
  pays.forEach(function (p) {
    if (String(p.status).toUpperCase() !== 'AKTIF' || String(p.kaedah).toUpperCase() !== 'KREDIT_RETURN') return;
    var src = hMap[String(p.sumber_doc).toUpperCase()];
    if (src && String(src.status).toUpperCase() === 'VOID') add('I9', 'KRITIKAL', 'KREDIT_RETURN ' + p.pay_no + ' AKTIF tetapi return sumber ' + p.sumber_doc + ' sudah VOID.');
  });

  var kritikal = anomali.filter(function (a) { return a.tahap === 'KRITIKAL'; }).length;
  var report = {
    keputusan: anomali.length ? 'MERAH' : 'HIJAU',
    bil_anomali: anomali.length, bil_kritikal: kritikal,
    anomali: anomali, masa: _nowKL(), oleh: by,
    ledger_baris: ledger.length, i8: i8Skip ? 'DILANGKAU (snapshot tidak aktif)' : 'OK',
    semakan: ['I1 baki ≥ 0', 'I2 ledger↔header', 'I3 lines↔ledger', 'I4 void lengkap', 'I5 transfer seimbang', 'I6 bayaran ≤ jumlah', 'I7 no unik + counter', 'I8 snapshot', 'I9 ledger tak mengecil + kredit return']
  };
  props.setProperty('laporan_integriti', JSON.stringify(report));
  _audit(by, 'semakIntegriti', report.keputusan, anomali.length + ' anomali (' + kritikal + ' kritikal) · ledger ' + ledger.length + ' baris');
  return _ok(report);
}

function a_getAnomali(body) {
  var raw = PropertiesService.getScriptProperties().getProperty('laporan_integriti');
  if (!raw) return _ok({ keputusan: 'BELUM', bil_anomali: 0, masa: '', mesej: 'Semakan integriti belum pernah dijalankan.' });
  var rep;
  try { rep = JSON.parse(raw); } catch (e) { return _ok({ keputusan: 'BELUM', bil_anomali: 0, masa: '' }); }
  if (body._sess.role !== 'ADMIN') return _ok({ keputusan: rep.keputusan, bil_anomali: rep.bil_anomali, bil_kritikal: rep.bil_kritikal, masa: rep.masa });
  return _ok(rep);
}

// ----- REBUILD COUNTERS (utiliti — bila I7 gagal) -----
function a_rebuildCounters(body) {
  return _withLock(function () {
    var props = PropertiesService.getScriptProperties();
    var maxBy = {};
    function trackMax(no) { var m = String(no).match(/^([A-Z]+)-?(\d+)$/); if (m) maxBy[m[1]] = Math.max(maxBy[m[1]] || 0, Number(m[2])); }
    _readSheet(SHEETS.DOC_HEADER).forEach(function (h) { trackMax(h.doc_no); });
    _readSheet(SHEETS.PAYMENTS).forEach(function (p) { trackMax(p.pay_no); });
    _readSheet(SHEETS.STOCK_COUNT).forEach(function (r) { trackMax(r.sc_no); });
    _readSheet(SHEETS.POSTAGE).forEach(function (r) { trackMax(r.pos_id); });
    var updated = [];
    Object.keys(maxBy).forEach(function (pfx) {
      var key = 'seq_' + pfx;
      var cur = Number(props.getProperty(key) || 0);
      if (cur < maxBy[pfx]) { props.setProperty(key, String(maxBy[pfx])); updated.push(pfx + ': ' + cur + '→' + maxBy[pfx]); }
    });
    _audit(body._sess.staff_id, 'rebuildCounters', '', updated.length ? updated.join(', ') : 'tiada perubahan');
    return _ok({ dikemaskini: updated, mesej: updated.length ? 'Counter dikemaskini: ' + updated.join(', ') : 'Semua counter sudah betul.' });
  });
}

// ----- KIRAAN STOK FIZIKAL (§4.13 — blind count) -----
function a_createStockCount(body) {
  var sess = body._sess;
  var lokasi = String(body.lokasi || '').trim().toUpperCase();
  if (!lokasi) return _err('Sila pilih lokasi.');
  if (lokasi !== 'WAREHOUSE' && lokasi !== 'ROSAK') {
    var o = _findOne(SHEETS.OUTLET, function (x) { return String(x.outlet_id).toUpperCase() === lokasi; });
    if (!o) return _err('Lokasi tidak sah (WAREHOUSE / ROSAK / outlet).');
  }
  return _withLock(function () {
    var adaDraf = _readSheet(SHEETS.STOCK_COUNT).some(function (r) {
      return String(r.lokasi).toUpperCase() === lokasi && String(r.status).toUpperCase() === 'DRAF';
    });
    if (adaDraf) return _err('Sudah ada sesi kiraan DRAF untuk ' + lokasi + '. Selesaikan atau tolak sesi itu dahulu.');

    var baki = _bakiMap(), btMap = _batchMap(), pMap = _produkMap();
    var anchor = _sheet(SHEETS.LEDGER).getLastRow();
    var scNo = _nextDocNo('SC');
    var now = _nowKL(), tarikh = _todayKL();
    var rows = [];
    Object.keys(baki).forEach(function (sku) {
      var lokMap = baki[sku][lokasi];
      if (!lokMap) return;
      Object.keys(lokMap).forEach(function (bid) {
        if (_num(lokMap[bid].qty) <= 0) return;
        rows.push({
          sc_no: scNo, status: 'DRAF', lokasi: lokasi, anchor_row: anchor, tarikh: tarikh,
          sku: sku, batch_id: bid, batch_no_ditemui: '', expiry_ditemui: '',
          qty_sistem: _num(lokMap[bid].qty), qty_fizikal: '', varians: '', adj_doc_no: '',
          created_by: sess.staff_id, created_at: now, processed_by: '', processed_at: ''
        });
      });
    });
    if (!rows.length) return _err('Tiada stok di ' + lokasi + ' untuk dikira.');
    rows.sort(function (a, b) { return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : (a.batch_id < b.batch_id ? -1 : 1); });
    _appendRowsByHeader(SHEETS.STOCK_COUNT, rows);
    _audit(sess.staff_id, 'createStockCount', scNo, lokasi + ' · ' + rows.length + ' baris');
    // qty_sistem TIDAK dihantar — blind count
    return _ok({
      sc_no: scNo, lokasi: lokasi, tarikh: tarikh, bilangan_baris: rows.length,
      baris: rows.map(function (r) {
        var bt = btMap[r.batch_id] || {}, p = pMap[r.sku] || {};
        return { sku: r.sku, nama: String(p.nama || r.sku), batch_id: r.batch_id, batch_no: String(bt.batch_no || ''), expiry: String(bt.expiry || ''), rak: String(bt.lokasi_rak || '') };
      })
    });
  });
}

function a_getStockCount(body) {
  var sess = body._sess;
  var scNo = String(body.sc_no || '').trim().toUpperCase();
  var all = _readSheet(SHEETS.STOCK_COUNT);
  if (!scNo) {
    // senarai sesi
    var byNo = {};
    all.forEach(function (r) {
      var n = String(r.sc_no);
      if (!byNo[n]) byNo[n] = { sc_no: n, status: String(r.status).toUpperCase(), lokasi: String(r.lokasi), tarikh: String(r.tarikh), bil_baris: 0, bil_dikira: 0, created_by: String(r.created_by), adj_doc_no: '' };
      byNo[n].bil_baris++;
      if (r.qty_fizikal !== '' && r.qty_fizikal !== null) byNo[n].bil_dikira++;
      if (String(r.adj_doc_no)) byNo[n].adj_doc_no = String(r.adj_doc_no);
      byNo[n].status = String(r.status).toUpperCase();
    });
    var sesi = Object.keys(byNo).map(function (n) { return byNo[n]; });
    sesi.sort(function (a, b) { return a.sc_no < b.sc_no ? 1 : -1; });
    return _ok({ sesi: sesi });
  }
  var rows = all.filter(function (r) { return String(r.sc_no).toUpperCase() === scNo; });
  if (!rows.length) return _err('Sesi ' + scNo + ' tiada.');
  var btMap = _batchMap(), pMap = _produkMap();
  var isAdmin = sess.role === 'ADMIN';
  return _ok({
    sc_no: scNo, sc_status: String(rows[0].status).toUpperCase(), lokasi: String(rows[0].lokasi),
    tarikh: String(rows[0].tarikh), created_by: String(rows[0].created_by),
    baris: rows.map(function (r) {
      var bt = btMap[String(r.batch_id)] || {}, p = pMap[String(r.sku)] || {};
      var o = {
        sku: String(r.sku), nama: String(p.nama || r.sku), batch_id: String(r.batch_id),
        batch_no: String(r.batch_id ? (bt.batch_no || '') : (r.batch_no_ditemui || '')),
        expiry: String(r.batch_id ? (bt.expiry || '') : (r.expiry_ditemui || '')),
        rak: String(bt.lokasi_rak || ''),
        qty_fizikal: r.qty_fizikal === '' || r.qty_fizikal === null ? null : _num(r.qty_fizikal),
        ditemui: !String(r.batch_id)
      };
      if (isAdmin) { // varians hanya untuk ADMIN (blind count untuk staf)
        o.qty_sistem = _num(r.qty_sistem);
        o.varians = o.qty_fizikal === null ? null : o.qty_fizikal - o.qty_sistem;
      }
      return o;
    }),
    adj_doc_no: String(rows[0].adj_doc_no || '')
  });
}

function a_saveStockCount(body) {
  var sess = body._sess;
  var scNo = String(body.sc_no || '').trim().toUpperCase();
  var baris = body.baris;
  if (!scNo) return _err('sc_no diperlukan.');
  if (!Array.isArray(baris) || !baris.length) return _err('Tiada baris untuk disimpan.');
  return _withLock(function () {
    var all = _readSheet(SHEETS.STOCK_COUNT);
    var rows = all.filter(function (r) { return String(r.sc_no).toUpperCase() === scNo; });
    if (!rows.length) return _err('Sesi ' + scNo + ' tiada.');
    if (String(rows[0].status).toUpperCase() !== 'DRAF') return _err('Sesi ' + scNo + ' bukan DRAF (sudah diproses).');

    var byKey = {};
    rows.forEach(function (r) {
      if (String(r.batch_id)) byKey[String(r.sku).toUpperCase() + '|' + String(r.batch_id)] = r;
      else if (String(r.batch_no_ditemui)) byKey['DITEMUI|' + String(r.sku).toUpperCase() + '|' + String(r.batch_no_ditemui).toUpperCase()] = r;
    });
    var pMap = _produkMap();
    var now = _nowKL();
    var newRows = [], saved = 0;
    for (var i = 0; i < baris.length; i++) {
      var b = baris[i];
      var sku = String(b.sku || '').trim().toUpperCase();
      var qf = b.qty_fizikal;
      if (qf === '' || qf === null || qf === undefined) continue; // tak diisi — langkau
      qf = Math.floor(_num(qf));
      if (qf < 0 || qf !== _num(b.qty_fizikal)) return _err('Baris ' + (i + 1) + ' (' + sku + '): qty fizikal mesti integer >= 0.');
      var batchId = String(b.batch_id || '').trim();
      if (batchId) {
        var row = byKey[sku + '|' + batchId];
        if (!row) return _err('Baris ' + (i + 1) + ': ' + sku + ' batch ' + batchId + ' tiada dalam sesi.');
        row.qty_fizikal = qf;
        _updateRow(SHEETS.STOCK_COUNT, row.__row, row);
        saved++;
      } else {
        // batch ditemui (kotak lama tak pernah masuk ledger)
        var bno = String(b.batch_no_ditemui || '').trim();
        if (!bno) return _err('Baris ' + (i + 1) + ': batch ditemui perlu nombor batch.');
        if (!pMap[sku]) return _err('Baris ' + (i + 1) + ': SKU "' + sku + '" tiada dalam master.');
        var kEx = 'DITEMUI|' + sku + '|' + bno.toUpperCase();
        if (byKey[kEx]) {
          byKey[kEx].qty_fizikal = qf;
          byKey[kEx].expiry_ditemui = String(b.expiry_ditemui || '').trim();
          _updateRow(SHEETS.STOCK_COUNT, byKey[kEx].__row, byKey[kEx]);
        } else {
          newRows.push({
            sc_no: scNo, status: 'DRAF', lokasi: String(rows[0].lokasi), anchor_row: rows[0].anchor_row,
            tarikh: String(rows[0].tarikh), sku: sku, batch_id: '',
            batch_no_ditemui: bno, expiry_ditemui: String(b.expiry_ditemui || '').trim(),
            qty_sistem: 0, qty_fizikal: qf, varians: '', adj_doc_no: '',
            created_by: sess.staff_id, created_at: now, processed_by: '', processed_at: ''
          });
        }
        saved++;
      }
    }
    if (newRows.length) _appendRowsByHeader(SHEETS.STOCK_COUNT, newRows);
    _audit(sess.staff_id, 'saveStockCount', scNo, saved + ' baris disimpan');
    return _ok({ sc_no: scNo, bil_disimpan: saved });
  });
}

function a_approveStockCount(body) {
  var sess = body._sess;
  var scNo = String(body.sc_no || '').trim().toUpperCase();
  if (!scNo) return _err('sc_no diperlukan.');
  return _withLock(function () {
    var rows = _readSheet(SHEETS.STOCK_COUNT).filter(function (r) { return String(r.sc_no).toUpperCase() === scNo; });
    if (!rows.length) return _err('Sesi ' + scNo + ' tiada.');
    if (String(rows[0].status).toUpperCase() !== 'DRAF') return _err('Sesi ' + scNo + ' bukan DRAF.');
    var lokasi = String(rows[0].lokasi).toUpperCase();
    var anchor = Number(rows[0].anchor_row || 0);

    // a. kiraan basi? — ledger bergerak utk (sku @ lokasi) sesi sejak anchor
    var skuSet = {};
    rows.forEach(function (r) { skuSet[String(r.sku).toUpperCase()] = true; });
    var ledger = _readSheet(SHEETS.LEDGER);
    for (var i = 0; i < ledger.length; i++) {
      var lr = ledger[i];
      if (lr.__row <= anchor) continue;
      if (String(lr.lokasi).toUpperCase() === lokasi && skuSet[String(lr.sku).toUpperCase()]) {
        return _err('Kiraan BASI — stok ' + lr.sku + ' di ' + lokasi + ' bergerak sejak kiraan dimula (doc ' + lr.doc_no + '). Tolak sesi & kira semula.');
      }
    }

    var btMap = _batchMap(), pMap = _produkMap();
    var now = _nowKL(), hariIni = _todayKL();
    var ledgerRows = [];

    // b. varians atas batch SEDIA ADA → ADJ
    var adjLines = [];
    rows.forEach(function (r) {
      if (!String(r.batch_id)) return;
      if (r.qty_fizikal === '' || r.qty_fizikal === null) { r.varians = ''; return; } // tak dikira — langkau
      var v = Math.floor(_num(r.qty_fizikal)) - _num(r.qty_sistem);
      r.varians = v;
      if (v === 0) return;
      var bt = btMap[String(r.batch_id)] || {};
      adjLines.push({ sku: String(r.sku).toUpperCase(), batch_id: String(r.batch_id), varians: v, kos: _rm(_sen(bt.kos_seunit_rm)) });
    });

    // c. batch ditemui → GRN subjenis PENEMUAN
    var foundLines = [];
    rows.forEach(function (r) {
      if (String(r.batch_id)) return;
      var qf = Math.floor(_num(r.qty_fizikal));
      if (qf <= 0) return;
      foundLines.push({ sku: String(r.sku).toUpperCase(), batch_no: String(r.batch_no_ditemui), expiry: String(r.expiry_ditemui || ''), qty: qf, __r: r });
    });

    var adjNo = '', grnNo = '';

    if (adjLines.length) {
      adjNo = _nextDocNo('ADJ');
      var adjId = _uid('DH-');
      _appendRowsByHeader(SHEETS.DOC_HEADER, [{
        doc_id: adjId, doc_no: adjNo, doc_type: 'ADJ', subjenis: 'KIRAAN', tarikh: hariIni,
        pihak_jenis: '-', pihak_id: scNo, lokasi_sasaran: lokasi,
        subtotal_rm: 0, diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0, postage_rm: 0, jumlah_bersih_rm: 0,
        kurier: '', no_tracking: '', berat_kg: 0, rujukan_order_web: scNo, status: 'AKTIF',
        void_reason: '', void_by: '', void_at: '', catatan: 'Pelarasan kiraan stok ' + scNo,
        client_ref: '', created_by: sess.staff_id, created_at: now
      }]);
      _appendRowsByHeader(SHEETS.DOC_LINES, adjLines.map(function (a) {
        return {
          line_id: _uid('LN-'), doc_id: adjId, doc_no: adjNo, sku: a.sku,
          nama_produk: String((pMap[a.sku] || {}).nama || a.sku), qty: Math.abs(a.varians),
          harga_seunit_rm: 0, jumlah_rm: 0, disposisi: a.varians > 0 ? 'MASUK' : 'KELUAR',
          batch_id_rujukan: a.batch_id, catatan_line: 'Varians kiraan ' + scNo
        };
      }));
      adjLines.forEach(function (a) {
        ledgerRows.push({
          ledger_id: _uid('L-'), created_at: now, tarikh_efektif: hariIni, doc_no: adjNo, doc_type: 'ADJ',
          sku: a.sku, batch_id: a.batch_id, arah: a.varians > 0 ? 1 : -1, qty: a.varians,
          lokasi: lokasi, kos_seunit_rm: a.kos, pihak: scNo, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id
        });
      });
    }

    if (foundLines.length) {
      grnNo = _nextDocNo('GRN');
      var grnId = _uid('DH-');
      var batchRows = [], grnLineRows = [], totalSen = 0;
      foundLines.forEach(function (f) {
        var p = pMap[f.sku] || {};
        var batchId = _uid('BT-');
        f.__batch_id = batchId;
        var kosSen = _sen(p.kos_rujukan_rm);
        var adaExp = String(p.ada_expiry || '').toUpperCase() === 'YES' ? 'YES' : 'TIDAK';
        batchRows.push({
          batch_id: batchId, sku: f.sku, batch_no: f.batch_no,
          expiry: adaExp === 'YES' ? f.expiry : '', ada_expiry: adaExp,
          kos_seunit_rm: _rm(kosSen), kos_anggaran: 'YES',
          lokasi_rak: '', grn_doc_no: grnNo, tarikh_terima: hariIni,
          created_by: sess.staff_id, created_at: now
        });
        grnLineRows.push({
          line_id: _uid('LN-'), doc_id: grnId, doc_no: grnNo, sku: f.sku,
          nama_produk: String(p.nama || f.sku), qty: f.qty, harga_seunit_rm: _rm(kosSen),
          jumlah_rm: _rm(f.qty * kosSen), disposisi: 'MASUK', batch_id_rujukan: batchId,
          catatan_line: 'Penemuan kiraan ' + scNo
        });
        ledgerRows.push({
          ledger_id: _uid('L-'), created_at: now, tarikh_efektif: hariIni, doc_no: grnNo, doc_type: 'GRN',
          sku: f.sku, batch_id: batchId, arah: 1, qty: f.qty, lokasi: lokasi,
          kos_seunit_rm: _rm(kosSen), pihak: scNo, is_reversal: 'NO', reversal_of: '', created_by: sess.staff_id
        });
        totalSen += f.qty * kosSen;
      });
      _appendRowsByHeader(SHEETS.BATCH, batchRows);
      _appendRowsByHeader(SHEETS.DOC_HEADER, [{
        doc_id: grnId, doc_no: grnNo, doc_type: 'GRN', subjenis: 'PENEMUAN', tarikh: hariIni,
        pihak_jenis: '-', pihak_id: scNo, lokasi_sasaran: lokasi,
        subtotal_rm: _rm(totalSen), diskaun_jenis: '', diskaun_input: 0, diskaun_rm: 0, postage_rm: 0,
        jumlah_bersih_rm: _rm(totalSen), kurier: '', no_tracking: '', berat_kg: 0,
        rujukan_order_web: scNo, status: 'AKTIF', void_reason: '', void_by: '', void_at: '',
        catatan: 'Batch ditemui semasa kiraan ' + scNo, client_ref: '', created_by: sess.staff_id, created_at: now
      }]);
      _appendRowsByHeader(SHEETS.DOC_LINES, grnLineRows);
    }

    // LEDGER TERAKHIR (baki-safe) + flush oleh _withLock
    if (ledgerRows.length) _appendRowsByHeader(SHEETS.LEDGER, ledgerRows);

    // d. kemaskini status sesi (in-place, diaudit)
    rows.forEach(function (r) {
      r.status = 'DILULUS';
      r.adj_doc_no = (adjNo && grnNo) ? adjNo + ' / ' + grnNo : (adjNo || grnNo || '');
      r.processed_by = sess.staff_id; r.processed_at = now;
      _updateRow(SHEETS.STOCK_COUNT, r.__row, r);
    });

    _audit(sess.staff_id, 'approveStockCount', scNo, (adjLines.length ? adjNo + ' (' + adjLines.length + ' varians)' : 'tiada varians') + (foundLines.length ? ' · ' + grnNo + ' (' + foundLines.length + ' penemuan)' : ''));
    return _ok({
      sc_no: scNo, adj_doc_no: adjNo, penemuan_grn: grnNo,
      bil_varians: adjLines.length, bil_penemuan: foundLines.length,
      mesej: adjLines.length || foundLines.length
        ? 'Diluluskan. ' + (adjLines.length ? adjNo + ' dijana (' + adjLines.length + ' varians).' : '') + (foundLines.length ? ' ' + grnNo + ' dijana (' + foundLines.length + ' batch ditemui).' : '')
        : 'Diluluskan — TIADA varians. Stok tally 🎉'
    });
  });
}

function a_rejectStockCount(body) {
  var sess = body._sess;
  var scNo = String(body.sc_no || '').trim().toUpperCase();
  var catatan = String(body.catatan || '').trim();
  if (!scNo) return _err('sc_no diperlukan.');
  return _withLock(function () {
    var rows = _readSheet(SHEETS.STOCK_COUNT).filter(function (r) { return String(r.sc_no).toUpperCase() === scNo; });
    if (!rows.length) return _err('Sesi ' + scNo + ' tiada.');
    if (String(rows[0].status).toUpperCase() !== 'DRAF') return _err('Sesi ' + scNo + ' bukan DRAF.');
    var now = _nowKL();
    rows.forEach(function (r) {
      r.status = 'DITOLAK'; r.processed_by = sess.staff_id; r.processed_at = now;
      _updateRow(SHEETS.STOCK_COUNT, r.__row, r);
    });
    _audit(sess.staff_id, 'rejectStockCount', scNo, catatan);
    return _ok({ sc_no: scNo, sc_status: 'DITOLAK' });
  });
}

// ----- LEDGER AUDIT (S13 — ADMIN sahaja) -----
function a_getLedger(body) {
  var fSku = String(body.sku || '').trim().toUpperCase();
  var fBatch = String(body.batch_id || '').trim();
  var fLokasi = String(body.lokasi || '').trim().toUpperCase();
  var fDoc = String(body.doc_no || '').trim().toUpperCase();
  var dari = String(body.dari || '').trim(), hingga = String(body.hingga || '').trim();
  var rows = _readSheet(SHEETS.LEDGER).filter(function (r) {
    if (fSku && String(r.sku).toUpperCase() !== fSku) return false;
    if (fBatch && String(r.batch_id) !== fBatch) return false;
    if (fLokasi && String(r.lokasi).toUpperCase() !== fLokasi) return false;
    if (fDoc && String(r.doc_no).toUpperCase().indexOf(fDoc) === -1) return false;
    var t = String(r.tarikh_efektif);
    if (dari && t < dari) return false;
    if (hingga && t > hingga) return false;
    return true;
  });
  var masuk = 0, keluar = 0;
  rows.forEach(function (r) { var q = _num(r.qty); if (q > 0) masuk += q; else keluar += -q; });
  var HAD = 500;
  var out = rows.slice(-HAD).map(function (r) {
    return {
      ledger_id: String(r.ledger_id), created_at: String(r.created_at), tarikh_efektif: String(r.tarikh_efektif),
      doc_no: String(r.doc_no), doc_type: String(r.doc_type), sku: String(r.sku), batch_id: String(r.batch_id),
      qty: _num(r.qty), lokasi: String(r.lokasi), kos_seunit_rm: _num(r.kos_seunit_rm), pihak: String(r.pihak || ''),
      is_reversal: String(r.is_reversal).toUpperCase() === 'YES', reversal_of: String(r.reversal_of || ''), created_by: String(r.created_by)
    };
  });
  return _ok({
    rows: out, jumlah_rekod: rows.length, dipotong: rows.length > HAD,
    footer: { masuk: masuk, keluar: keluar, baki: masuk - keluar }
  });
}

// ===================== M6: DASHBOARD + RINGKASAN + TRIGGERS =====================
/**
 * Dashboard (S1 strip + S2). ADMIN dapat semua; WAREHOUSE ditapis SERVER
 * (tiada kad kewangan/hutang/ranking — §7).
 */
function a_getDashboard(body) {
  var sess = body._sess;
  var isAdmin = sess.role === 'ADMIN';
  var bulan = String(body.bulan || _todayKL().slice(0, 7)); // yyyy-MM
  var hariIni = _todayKL();
  var cfg = _settingsMap();

  var headers = _readSheet(SHEETS.DOC_HEADER);
  var ledger = _readSheet(SHEETS.LEDGER);
  var pMap = _produkMap();
  var agg = _payAgg();

  // baki per sku per lokasi (dari ledger yang sama)
  var baki = {}; // {sku: {lokasi: qty}}, nilai stok ikut kos batch
  var nilaiStokSen = 0;
  var bakiBatch = {}; // {sku|lokasi|batch: {qty,kos}}
  ledger.forEach(function (r) {
    var sku = String(r.sku || ''), lok = String(r.lokasi || ''), bid = String(r.batch_id || '');
    if (!sku || !lok || !bid) return;
    var k = sku + '|' + lok + '|' + bid;
    if (!bakiBatch[k]) bakiBatch[k] = { sku: sku, lokasi: lok, qty: 0, kos: 0 };
    bakiBatch[k].qty += _num(r.qty);
    if (_num(r.kos_seunit_rm) > 0) bakiBatch[k].kos = _num(r.kos_seunit_rm);
  });
  Object.keys(bakiBatch).forEach(function (k) {
    var b = bakiBatch[k];
    if (b.qty <= 0) return;
    if (!baki[b.sku]) baki[b.sku] = {};
    baki[b.sku][b.lokasi] = (baki[b.sku][b.lokasi] || 0) + b.qty;
    if (b.lokasi !== 'ROSAK') nilaiStokSen += b.qty * _sen(b.kos); // nilai stok TIDAK termasuk kuarantin
  });

  // ----- S1: hari ini -----
  var doHariIni = headers.filter(function (h) {
    return String(h.doc_type) === 'DO_EJEN' && String(h.status).toUpperCase() === 'AKTIF' && String(h.tarikh) === hariIni;
  });
  var jualanHariIniSen = 0;
  headers.forEach(function (h) {
    var dt = String(h.doc_type);
    if ((dt === 'DO_EJEN' || dt === 'JUAL_OUTLET') && String(h.status).toUpperCase() === 'AKTIF' && String(h.tarikh) === hariIni) {
      jualanHariIniSen += _sen(h.subtotal_rm) - _sen(h.diskaun_rm);
    }
  });
  var posDone = {};
  _readSheet(SHEETS.POSTAGE).forEach(function (p) { if (String(p.no_tracking || '').trim()) posDone[String(p.do_no)] = true; });
  var belumPos = headers.filter(function (h) {
    return String(h.doc_type) === 'DO_EJEN' && String(h.status).toUpperCase() === 'AKTIF' &&
      !posDone[String(h.doc_no)] && !String(h.no_tracking || '').trim();
  }).length;
  var ejenNama = {};
  _readSheet(SHEETS.EJEN).forEach(function (e) { ejenNama[String(e.ejen_id).toUpperCase()] = String(e.nama || e.ejen_id); });
  var doTerkini = headers.filter(function (h) { return String(h.doc_type) === 'DO_EJEN'; })
    .sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? 1 : -1; })
    .slice(0, 10)
    .map(function (h) {
      var st = String(h.status).toUpperCase();
      var dib = agg.dibayar[String(h.doc_no)] || 0;
      return {
        doc_no: String(h.doc_no), tarikh: String(h.tarikh),
        ejen: ejenNama[String(h.pihak_id).toUpperCase()] || String(h.pihak_id),
        jumlah_rm: _num(h.jumlah_bersih_rm),
        status: st === 'AKTIF' ? _statusBayar(dib, _sen(h.jumlah_bersih_rm)) : st,
        ada_tracking: !!(posDone[String(h.doc_no)] || String(h.no_tracking || '').trim())
      };
    });

  // ----- integriti (laporan terakhir) -----
  var integriti = { keputusan: 'BELUM', bil_anomali: 0, masa: '' };
  var rawI = PropertiesService.getScriptProperties().getProperty('laporan_integriti');
  if (rawI) { try { var ri = JSON.parse(rawI); integriti = { keputusan: ri.keputusan, bil_anomali: ri.bil_anomali, bil_kritikal: ri.bil_kritikal, masa: ri.masa }; } catch (e) {} }

  // ----- expiry alerts (ringkas) + stok bawah min -----
  var btMap = _batchMap();
  var alertHari = Number(cfg.tempoh_alert_expiry_hari || 90), kritHari = Number(cfg.tempoh_expiry_kritikal_hari || 30);
  var cutKuning = _addDaysKL(hariIni, alertHari), cutMerah = _addDaysKL(hariIni, kritHari);
  var expMerah = [], expKuning = [], expDone = {};
  Object.keys(bakiBatch).forEach(function (k) {
    var b = bakiBatch[k];
    if (b.qty <= 0 || b.lokasi === 'ROSAK') return;
    var bid = k.split('|')[2];
    var bt = btMap[bid] || {};
    if (String(bt.ada_expiry).toUpperCase() !== 'YES') return;
    var exp = String(bt.expiry || '').trim();
    if (!exp || exp > cutKuning) return;
    var row = { sku: b.sku, batch_no: String(bt.batch_no || ''), expiry: exp, lokasi: b.lokasi, baki: b.qty };
    if (exp <= cutMerah) expMerah.push(row); else expKuning.push(row);
  });
  expMerah.sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
  expKuning.sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
  var bawahMin = [];
  Object.keys(pMap).forEach(function (sku) {
    var min = _num(pMap[sku].min_stok_wh);
    if (min <= 0 || String(pMap[sku].aktif).toUpperCase() !== 'YES') return;
    var wh = (baki[sku] && baki[sku]['WAREHOUSE']) || 0;
    if (wh < min) bawahMin.push({ sku: sku, nama: String(pMap[sku].nama || sku), baki_wh: wh, min: min });
  });
  bawahMin.sort(function (a, b) { return (a.baki_wh / a.min) - (b.baki_wh / b.min); });

  var out = {
    bulan: bulan, integriti: integriti,
    s1: { bil_do_hari_ini: doHariIni.length, jualan_hari_ini_rm: _rm(jualanHariIniSen), bil_belum_pos: belumPos, do_terkini: doTerkini },
    expiry: { merah: expMerah.slice(0, 15), kuning: expKuning.slice(0, 15), bil_merah: expMerah.length, bil_kuning: expKuning.length },
    bawah_min: bawahMin.slice(0, 15)
  };
  if (!isAdmin) return _ok(out); // WAREHOUSE berhenti di sini — tiada kewangan (§7)

  // ----- KPI bulan (ADMIN) §4.11 -----
  var jualanEjenSen = 0, jualanOutletSen = 0, returnSen = 0, hutangSen = 0;
  headers.forEach(function (h) {
    var dt = String(h.doc_type), st = String(h.status).toUpperCase();
    if (st !== 'AKTIF') return;
    var dlmBulan = String(h.tarikh).slice(0, 7) === bulan;
    if (dt === 'DO_EJEN') {
      var bakiDoSen = _sen(h.jumlah_bersih_rm) - (agg.dibayar[String(h.doc_no)] || 0);
      if (bakiDoSen > 0) hutangSen += bakiDoSen;
      if (dlmBulan) jualanEjenSen += _sen(h.subtotal_rm) - _sen(h.diskaun_rm); // postage dikecualikan
    } else if (dt === 'JUAL_OUTLET' && dlmBulan) jualanOutletSen += _sen(h.jumlah_bersih_rm);
    else if (dt === 'RTN_EJEN' && dlmBulan) returnSen += _sen(h.jumlah_bersih_rm);
  });
  var kutipanSen = 0;
  _readSheet(SHEETS.PAYMENTS).forEach(function (p) {
    if (String(p.status).toUpperCase() !== 'AKTIF') return;
    var kd = String(p.kaedah).toUpperCase();
    if (kd === 'KREDIT_RETURN' || kd === 'KREDIT_GUNA') return; // bukan wang masuk
    if (String(p.tarikh).slice(0, 7) === bulan) kutipanSen += _sen(p.amaun_rm);
  });
  kutipanSen += jualanOutletSen; // jualan outlet = tunai terus (§4.11)

  // ----- ranking ejen §4.9 (jualan − return bulan; postage keluar) -----
  var jualanByEjen = {}, returnByEjen = {};
  headers.forEach(function (h) {
    if (String(h.status).toUpperCase() !== 'AKTIF' || String(h.tarikh).slice(0, 7) !== bulan) return;
    var ej = String(h.pihak_id).toUpperCase();
    if (String(h.doc_type) === 'DO_EJEN') jualanByEjen[ej] = (jualanByEjen[ej] || 0) + _sen(h.subtotal_rm) - _sen(h.diskaun_rm);
    if (String(h.doc_type) === 'RTN_EJEN') returnByEjen[ej] = (returnByEjen[ej] || 0) + _sen(h.jumlah_bersih_rm);
  });
  var ranking = _readSheet(SHEETS.EJEN)
    .filter(function (e) { return String(e.aktif).toUpperCase() === 'YES'; })
    .map(function (e) {
      var ej = String(e.ejen_id).toUpperCase();
      var jualSen = (jualanByEjen[ej] || 0) - (returnByEjen[ej] || 0);
      var tgtSen = _sen(e.target_bulanan_rm);
      return {
        ejen_id: e.ejen_id, nama: String(e.nama || ''), jualan_rm: _rm(jualSen), target_rm: _rm(tgtSen),
        pct_capai: tgtSen > 0 ? Math.round(jualSen / tgtSen * 100) : null
      };
    })
    .sort(function (a, b) { return _sen(b.jualan_rm) - _sen(a.jualan_rm); });
  ranking.forEach(function (r, i) { r.rank = i + 1; });

  // ----- pending payment per ejen (terbesar dulu) §R7c -----
  var hutangByEjen = {};
  headers.forEach(function (h) {
    if (String(h.doc_type) !== 'DO_EJEN' || String(h.status).toUpperCase() !== 'AKTIF') return;
    var b = _sen(h.jumlah_bersih_rm) - (agg.dibayar[String(h.doc_no)] || 0);
    if (b > 0) {
      var ej = String(h.pihak_id).toUpperCase();
      if (!hutangByEjen[ej]) hutangByEjen[ej] = { sen: 0, tertua: String(h.tarikh) };
      hutangByEjen[ej].sen += b;
      if (String(h.tarikh) < hutangByEjen[ej].tertua) hutangByEjen[ej].tertua = String(h.tarikh);
    }
  });
  var pending = Object.keys(hutangByEjen).map(function (ej) {
    return { ejen_id: ej, nama: ejenNama[ej] || ej, hutang_rm: _rm(hutangByEjen[ej].sen), do_tertua: hutangByEjen[ej].tertua };
  }).sort(function (a, b) { return _sen(b.hutang_rm) - _sen(a.hutang_rm); });

  // ----- stok laju / slow / risiko habis §4.10 -----
  var T = Number(cfg.tempoh_velocity_hari || 30);
  var slowHari = Number(cfg.tempoh_slow_moving_hari || 60);
  var cutT = _addDaysKL(hariIni, -T), cutSlow = _addDaysKL(hariIni, -slowHari);
  var keluarJualan = {}, lastSale = {};
  ledger.forEach(function (r) {
    var dt = String(r.doc_type);
    if (dt !== 'DO_EJEN' && dt !== 'JUAL_OUTLET') return;
    var t = String(r.tarikh_efektif);
    var sku = String(r.sku).toUpperCase();
    // reversal termasuk secara semula jadi (qty positif menolak jualan)
    if (t >= cutT) keluarJualan[sku] = (keluarJualan[sku] || 0) + (-_num(r.qty));
    if (String(r.is_reversal).toUpperCase() !== 'YES' && (!lastSale[sku] || t > lastSale[sku])) lastSale[sku] = t;
  });
  var laju = [], slow = [], risiko = [];
  Object.keys(pMap).forEach(function (sku) {
    if (String(pMap[sku].aktif).toUpperCase() !== 'YES') return;
    var nama = String(pMap[sku].nama || sku);
    var jualBoleh = 0; // baki semua lokasi jualan (bukan ROSAK)
    if (baki[sku]) Object.keys(baki[sku]).forEach(function (lok) { if (lok !== 'ROSAK') jualBoleh += baki[sku][lok]; });
    var keluar = keluarJualan[sku] || 0;
    if (keluar > 0) laju.push({ sku: sku, nama: nama, keluar: keluar, baki: jualBoleh });
    if (jualBoleh > 0 && (!lastSale[sku] || lastSale[sku] < cutSlow)) slow.push({ sku: sku, nama: nama, baki: jualBoleh, jualan_terakhir: lastSale[sku] || '(tiada)' });
    if (keluar > 0) {
      var dos = jualBoleh / (keluar / T);
      if (dos < 14) risiko.push({ sku: sku, nama: nama, baki: jualBoleh, hari_lagi: Math.floor(dos) });
    }
  });
  laju.sort(function (a, b) { return b.keluar - a.keluar; });
  risiko.sort(function (a, b) { return a.hari_lagi - b.hari_lagi; });

  out.kpi = {
    nilai_stok_rm: _rm(nilaiStokSen), jualan_bulan_rm: _rm(jualanEjenSen + jualanOutletSen - returnSen),
    kutipan_bulan_rm: _rm(kutipanSen), hutang_tertunggak_rm: _rm(hutangSen)
  };
  out.ranking_ejen = ranking;
  out.pending_payments = pending;
  out.stok_laju = laju.slice(0, 10);
  out.stok_slow = slow.slice(0, 10);
  out.risiko_habis = risiko.slice(0, 10);
  return _ok(out);
}

/** Ringkasan operasi bulanan §4.11 — BUKAN P&L. Dikira-pada-baca (VOID melaras retroaktif). */
function a_getRingkasanBulanan(body) {
  var tahun = String(body.tahun || _todayKL().slice(0, 4));
  var bulanIni = _todayKL().slice(0, 7);
  var headers = _readSheet(SHEETS.DOC_HEADER);
  var pays = _readSheet(SHEETS.PAYMENTS);
  var ledger = _readSheet(SHEETS.LEDGER);

  var M = {};
  function bag(b) { if (!M[b]) M[b] = { jualan_ejen: 0, jualan_outlet: 0, postage: 0, retur: 0, kutipan: 0, belian_stok: 0, write_off: 0 }; return M[b]; }

  headers.forEach(function (h) {
    if (String(h.status).toUpperCase() !== 'AKTIF') return;
    var b = String(h.tarikh).slice(0, 7);
    if (b.slice(0, 4) !== tahun) return;
    var dt = String(h.doc_type), sj = String(h.subjenis || '').toUpperCase();
    if (dt === 'DO_EJEN') { bag(b).jualan_ejen += _sen(h.subtotal_rm) - _sen(h.diskaun_rm); bag(b).postage += _sen(h.postage_rm); }
    else if (dt === 'JUAL_OUTLET') bag(b).jualan_outlet += _sen(h.jumlah_bersih_rm);
    else if (dt === 'RTN_EJEN') bag(b).retur += _sen(h.jumlah_bersih_rm);
    else if (dt === 'GRN' && sj !== 'BAKI_AWAL' && sj !== 'PENEMUAN') bag(b).belian_stok += _sen(h.jumlah_bersih_rm);
  });
  pays.forEach(function (p) {
    if (String(p.status).toUpperCase() !== 'AKTIF') return;
    var kd = String(p.kaedah).toUpperCase();
    if (kd === 'KREDIT_RETURN' || kd === 'KREDIT_GUNA') return;
    var b = String(p.tarikh).slice(0, 7);
    if (b.slice(0, 4) === tahun) bag(b).kutipan += _sen(p.amaun_rm);
  });
  var statusDoc = {};
  headers.forEach(function (h) { statusDoc[String(h.doc_no).toUpperCase()] = String(h.status).toUpperCase(); });
  ledger.forEach(function (r) {
    var dt = String(r.doc_type);
    if (dt !== 'LUPUS' && dt !== 'ADJ') return;
    if (statusDoc[String(r.doc_no).toUpperCase()] !== 'AKTIF') return; // doc VOID → keluar dari laporan (recompute-on-read)
    var b = String(r.tarikh_efektif).slice(0, 7);
    if (b.slice(0, 4) !== tahun) return;
    var q = _num(r.qty);
    if (q < 0 && String(r.is_reversal).toUpperCase() !== 'YES') bag(b).write_off += -q * _sen(r.kos_seunit_rm);
  });

  var rows = [];
  for (var m = 1; m <= 12; m++) {
    var b = tahun + '-' + String(m).padStart(2, '0');
    if (b > bulanIni) break;
    var v = M[b] || bag(b);
    var kutipanPenuh = v.kutipan + v.jualan_outlet; // jualan outlet = tunai terus
    rows.push({
      bulan: b,
      jualan_ejen_rm: _rm(v.jualan_ejen), jualan_outlet_rm: _rm(v.jualan_outlet),
      postage_rm: _rm(v.postage), return_rm: _rm(v.retur),
      jualan_kasar_rm: _rm(v.jualan_ejen + v.jualan_outlet - v.retur),
      kutipan_rm: _rm(kutipanPenuh), belian_stok_rm: _rm(v.belian_stok), write_off_rm: _rm(v.write_off)
    });
  }
  return _ok({ tahun: tahun, bulanan: rows, nota: 'Ringkasan operasi — BUKAN penyata akaun. Angka dikira-pada-baca; VOID kemudian melaras bulan lalu secara retroaktif.' });
}

// ----- TRIGGERS (§5.4) — jalankan setupTriggers() SEKALI dalam editor selepas deploy -----
function setupTriggers() {
  // padam trigger lama projek ini (idempotent)
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('backupHarian').timeBased().atHour(1).everyDays(1).create();
  ScriptApp.newTrigger('semakIntegritiHarian').timeBased().atHour(6).everyDays(1).create();
  return 'Trigger dipasang: keepWarm (5min), backupHarian (1 pagi), semakIntegritiHarian (6 pagi).';
}

function keepWarm() { _readSheet(SHEETS.SETTINGS); } // elak cold start

function _adminEmail() {
  var e = String(_settingsMap().admin_email || '').trim();
  return e || Session.getEffectiveUser().getEmail();
}

function semakIntegritiHarian() {
  var res = _withLock(function () { return _runIntegriti('TRIGGER'); });
  try {
    if (res && res.bil_kritikal > 0) {
      MailApp.sendEmail(_adminEmail(), '🔴 OLIN INVENTORI: INTEGRITI MERAH (' + res.bil_kritikal + ' kritikal)',
        'Semakan integriti ' + res.masa + ' menemui ' + res.bil_anomali + ' anomali:\n\n' +
        res.anomali.map(function (a) { return '[' + a.kod + ' ' + a.tahap + '] ' + a.mesej; }).join('\n') +
        '\n\nBuka sistem → Master & Tetapan → Semak Integriti untuk detail.');
    }
  } catch (e) { /* e-mel gagal tak patut gagalkan trigger */ }
}

function backupHarian() {
  try {
    var cfg = _settingsMap();
    var folderId = String(cfg.backup_folder_id || '').trim();
    var nama = 'OlinV2-backup-' + _todayKL();
    var file = DriveApp.getFileById(_ss().getId());
    var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    file.makeCopy(nama, folder);
    // padam backup lama > backup_simpan_hari
    var hadHari = Number(cfg.backup_simpan_hari || 30);
    var cutoff = _addDaysKL(_todayKL(), -hadHari);
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var m = f.getName().match(/^OlinV2-backup-(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] < cutoff) f.setTrashed(true);
    }
  } catch (e) {
    try { MailApp.sendEmail(_adminEmail(), '⚠️ OLIN INVENTORI: backup harian GAGAL', 'Ralat: ' + e.toString()); } catch (e2) {}
  }
}

function a_runBackupNow(body) {
  try {
    backupHarian();
    _audit(body._sess.staff_id, 'runBackupNow', '', 'manual');
    return _ok({ mesej: 'Backup dibuat: OlinV2-backup-' + _todayKL() + (String(_settingsMap().backup_folder_id || '').trim() ? '' : ' (root My Drive — set backup_folder_id untuk folder khusus)') });
  } catch (e) { return _err('Backup gagal: ' + e.toString()); }
}

// ===================== SEED: PRODUK M1 (50 produk) =====================
function _seedProduk() {
  if (_readSheet(SHEETS.PRODUK).length) return; // skip jika dah ada
  var now = _nowKL();
  var NO_EXP = { WAIST:1, SHOULDER:1, SLIPPER:1, NECK:1, KNEE:1, TOTE:1, THE:1, FB:1, PXL:1, TUDUNG:1 };
  var CAT = {
    JATRO:'PENJAGAAN DIRI', KDN:'MAKANAN', BIO:'PENJAGAAN DIRI', BMAC:'PENJAGAAN DIRI',
    BMAS:'PENJAGAAN DIRI', VCC:'PENJAGAAN DIRI', MMW:'PENJAGAAN DIRI', MO:'PENJAGAAN DIRI',
    RW:'PENJAGAAN DIRI', SS:'PENJAGAAN DIRI', ZM:'PENJAGAAN DIRI', SKZ:'PENJAGAAN DIRI',
    IVS:'PENJAGAAN DIRI', COL:'PENJAGAAN DIRI', FLEXY:'MINUMAN', NUTRI:'MAKANAN',
    SERAI:'PENJAGAAN DIRI', GMB:'PENJAGAAN DIRI', OOJ:'PENJAGAAN DIRI', MR:'PENJAGAAN DIRI',
    KRS:'MINUMAN', KRSM:'MINUMAN', KR:'MINUMAN', KRM:'MINUMAN', RV:'PENJAGAAN DIRI',
    CRYO:'PENJAGAAN DIRI', NARIA:'PENJAGAAN DIRI', KHELIN:'PENJAGAAN DIRI', AHC:'PENJAGAAN DIRI',
    LEMERA:'PENJAGAAN DIRI', ITP:'MINUMAN', SMS:'PENJAGAAN DIRI', EU:'PENJAGAAN DIRI',
    CEN:'PENJAGAAN DIRI', PTD:'PENJAGAAN DIRI', DMARCO:'MINUMAN', DMB:'MINUMAN',
    WAIST:'ALAT KESIHATAN', SHOULDER:'ALAT KESIHATAN', SLIPPER:'ALAT KESIHATAN',
    NECK:'ALAT KESIHATAN', KNEE:'ALAT KESIHATAN', TOTE:'MERCHANDISE', MF:'PENJAGAAN DIRI',
    THE:'MERCHANDISE', FB:'MERCHANDISE', MUS:'PENJAGAAN DIRI', KDP:'MAKANAN',
    PXL:'MERCHANDISE', TUDUNG:'MERCHANDISE'
  };
  // [sku, nama, kos_rm, harga_ejen_rm]
  var raw = [
    ['JATRO','MINYAK JATRO PHORA',116.4,127.5], ['KDN','KURMA DHUHA',79.2,88.0],
    ['BIO','BIO 10',45.0,46.2], ['BMAC','BIO MIRACLE ACTION CREAM',25.4,29.4],
    ['BMAS','BIO MIRACLE ACTION SERUM',20.25,23.4], ['VCC','VINEFERA CC COVER',29.25,39.0],
    ['MMW','MELLIA MICELLAR WATER',14.4,18.0], ['MO','MARJANE OIL',24.0,30.0],
    ['RW','ROSE SPRING WATER',18.25,22.8], ['SS','SILKY SUNSCREEN',21.5,25.8],
    ['ZM','ZINNIA MAGENTA',17.5,21.0], ['SKZ','SKINZEN FACE OIL',81.6,94.8],
    ['IVS','INVISYBLE INTIMATE SPRAY',71.5,77.35], ['COL','COLONIS D\'MESTICA',33.6,42.0],
    ['FLEXY','FLEXY DRINK',94.9,102.7], ['NUTRI','NUTRI HI-B',109.5,118.5],
    ['SERAI','GEL MANDIAN SERAI SITRUS',27.0,31.5], ['GMB','GEL MANDIAN BIDARA ARAB',28.6,33.0],
    ['OOJ','OIL OF JAVANICA',29.4,34.3], ['MR','MEGA RATU EXTRA PREMIUM',60.0,75.6],
    ['KRS','KOPI ROMAGELLA STRAWBERRY',24.3,27.9], ['KRSM','KOPI ROMAGELA MINI BOX',0,0],
    ['KR','KOPI RATU',26.4,31.2], ['KRM','KOPI RATU MINI BOX',0,0],
    ['RV','ROYAL V',57.85,66.75], ['CRYO','HERBAL CYRO SPRAY',19.1,23.4],
    ['NARIA','MINYAK NARIA ROMASTY',73.6,80.75], ['KHELIN','MINYAK KHELIN MYRHA',85.25,93.5],
    ['AHC','AKASIA HONEY CLEANSER',17.5,21.0], ['LEMERA','LLEMERRA HYDRO FACE SCRUB',19.5,23.4],
    ['ITP','ICE TEA PEACH MENGKUDU',15.5,17.9], ['SMS','SUPER MOIST SOAP',8.45,10.8],
    ['EU','EU KALYPTO SOAP',11.15,13.9], ['CEN','CENANGA AROMATHERAPHY OIL',8.0,10.2],
    ['PTD','PUTIK TELAGA DARA',20.8,24.0], ['DMARCO','KOPI DMARCO',22.25,25.65],
    ['DMB','DMARCO MINI BOX',0,0], ['WAIST','HEATING STRAP WAIST',202.5,216.0],
    ['SHOULDER','HEATING STRAP SHOULDER',202.5,216.0], ['SLIPPER','HEATING STRAP SLIPPER',187.5,200.0],
    ['NECK','HEATING STRAP NECK',145.0,159.2], ['KNEE','HEATING STRAP KNEE',167.5,184.0],
    ['TOTE','TOTE BAG',0,0], ['MF','MAGNESIUM CHLORIDE FLAKES',45.0,55.0],
    ['THE','THERMOS',0,0], ['FB','FLOPPY BAG',0,0], ['MUS','MUSHTANIR',55.0,72.0],
    ['KDP','KURMA DHUHA (PROMO)',55.0,70.0], ['PXL','PLASTIK XL',0,0.85],
    ['TUDUNG','TUDUNG',0,0]
  ];
  var rows = raw.map(function (r) {
    var sku = r[0];
    return {
      sku: sku, nama: r[1], kategori: CAT[sku] || 'LAIN', jenis_item: 'PRODUK',
      ada_expiry: NO_EXP[sku] ? 'TIDAK' : 'YES',
      kos_rujukan_rm: r[2] || 0, harga_ejen_rm: r[3] || 0,
      harga_outlet_rm: 0, harga_runcit_rm: 0,
      berat_gram: 0, min_stok_wh: 0, aktif: 'YES',
      updated_by: 'SYSTEM', updated_at: now
    };
  });
  _appendRowsByHeader(SHEETS.PRODUK, rows);
}
