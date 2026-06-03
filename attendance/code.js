
// ==========================================
// Keep Warm — setup trigger: setiap 5 minit
// Extensions → Apps Script → Triggers → keepWarm → Time-driven → Every 5 minutes
// ==========================================
function keepWarm() {
  Logger.log("warm");
}

// ==========================================
// Init.gs - (Inisialisasi & Penghalaan)
// ==========================================

const SS = SpreadsheetApp.getActiveSpreadsheet();
const CONFIG_SHEET = SS.getSheetByName("Config");
const LOG_SHEET = SS.getSheetByName("Log_Kehadiran");
const USER_SHEET = SS.getSheetByName("Users");

// doGet mengendalikan semua API calls dari HTML luar (CORS-safe).
// Data dihantar sebagai query param: ?data={"action":"...","key":"val"}
function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  if (e.parameter && e.parameter.data) {
    var result;
    try {
      var body = JSON.parse(e.parameter.data);
      var action = body.action;

      if      (action === "getStaffList")                  result = getStaffList();
      else if (action === "verifyLogin")                   result = verifyLogin(body.u, body.p);
      else if (action === "loginAndGetDashboard")          result = loginAndGetDashboard(body.ic);
      else if (action === "loginWithTodayStatus")          result = loginWithTodayStatus(body.ic);
      else if (action === "getQuickDashboardData")         result = getQuickDashboardData(body.username);
      else if (action === "verifyAdminLogin")              result = verifyAdminLogin(body.username, body.password);
      else if (action === "getLaporanKelewatan")           result = getLaporanKelewatan(body.staffName, body.month, body.year);
      else if (action === "saveOutstationBatch")           result = saveOutstationBatch(body.payload);
      else if (action === "getWarningSettings")            result = getWarningSettings();
      else if (action === "saveWarningSettings")           result = saveWarningSettings(body.payload);
      else if (action === "getWarningReport")              result = getWarningReport(body.month, body.year);
      else if (action === "generateSuratAmaran")           result = generateSuratAmaran(body.staffName, body.month, body.year);
      else if (action === "resetStaffWarning")             result = resetStaffWarning(body.staffName, body.month, body.year);
      else if (action === "processScan")                   result = processScan(body.payload);
      else if (action === "processClockOut")               result = processClockOut(body.payload);
      else if (action === "getDashboardStatus")            result = getDashboardStatus();
      else if (action === "getAdminDashboardData")         result = getAdminDashboardData(body.targetDateRaw);
      else if (action === "getStaffDashboardData")         result = getStaffDashboardData(body.username);
      else if (action === "getStaffAttendanceByDateRange") result = getStaffAttendanceByDateRange(body.username, body.dateStart, body.dateEnd);
      else if (action === "getAllLeaveLog")                 result = getAllLeaveLog();
      else if (action === "getLeaveTypes")                 result = getLeaveTypes();
      else if (action === "getLeaveValidationConfig")      result = getLeaveValidationConfig();
      else if (action === "getLeaveBalance")               result = getLeaveBalance(body.staffName);
      else if (action === "processLeaveStatus")            result = processLeaveStatus(body.rowIndex, body.status, body.reason || "");
      else if (action === "setStaffLate")                  result = setStaffLate(body.nama);
      else if (action === "getSystemConfig")               result = getSystemConfig();
      else if (action === "saveSystemConfig")              result = saveSystemConfig(body.payload);
      else if (action === "generateNewToken")              result = generateNewToken();
      else if (action === "getStaffManagementData")        result = getStaffManagementData();
      else if (action === "saveStaffData")                 result = saveStaffData(body.payload);
      else if (action === "getOutstationList")             result = getOutstationList();
      else if (action === "saveOutstation")                result = saveOutstation(body.payload);
      else if (action === "deleteOutstation")              result = deleteOutstation(body.rowIndex);
      else if (action === "processOutstationAutoClockIn")  result = processOutstationAutoClockIn();
      else if (action === "setupOutstationTrigger")        result = setupOutstationTrigger(body.triggerTime);
      else if (action === "saveOutstationTriggerTime_web") result = saveOutstationTriggerTime_web(body.triggerTime);
      else if (action === "getOutstationTriggerTime")      result = getOutstationTriggerTime();
      else if (action === "changeLeaveType")               result = changeLeaveType(body.rowIndex, body.newLeaveType, body.staffName);
      else if (action === "getHistoryRange")               result = getHistoryRange(body.dates);
      else result = { status: "ERROR", message: "Unknown action: " + action };
    } catch (err) {
      result = { status: "ERROR", message: "Router error: " + err.toString() };
    }
    output.setContent(JSON.stringify(result));
    return output;
  }

  // Tiada data param — balik status sahaja
  output.setContent(JSON.stringify({ status: "OK", message: "Wazza API running." }));
  return output;
}

// Router utama untuk semua panggilan dari HTML luar.
// HTML hantar POST dengan Content-Type: text/plain (untuk elak CORS preflight).
// Body: JSON string dengan field "action" + parameter lain.
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if      (action === "getStaffList")                  result = getStaffList();
    else if (action === "verifyLogin")                   result = verifyLogin(body.u, body.p);
    else if (action === "loginAndGetDashboard")          result = loginAndGetDashboard(body.ic);
    else if (action === "loginWithTodayStatus")          result = loginWithTodayStatus(body.ic);
    else if (action === "getQuickDashboardData")         result = getQuickDashboardData(body.username);
    else if (action === "verifyAdminLogin")              result = verifyAdminLogin(body.username, body.password);
    else if (action === "getLaporanKelewatan")           result = getLaporanKelewatan(body.staffName, body.month, body.year);
    else if (action === "saveOutstationBatch")           result = saveOutstationBatch(body.payload);
    else if (action === "getWarningSettings")            result = getWarningSettings();
    else if (action === "saveWarningSettings")           result = saveWarningSettings(body.payload);
    else if (action === "getWarningReport")              result = getWarningReport(body.month, body.year);
    else if (action === "generateSuratAmaran")           result = generateSuratAmaran(body.staffName, body.month, body.year);
    else if (action === "resetStaffWarning")             result = resetStaffWarning(body.staffName, body.month, body.year);
    else if (action === "processScan")                   result = processScan(body.payload);
    else if (action === "processClockOut")               result = processClockOut(body.payload);
    else if (action === "getDashboardStatus")            result = getDashboardStatus();
    else if (action === "getAdminDashboardData")         result = getAdminDashboardData(body.targetDateRaw);
    else if (action === "getStaffDashboardData")         result = getStaffDashboardData(body.username);
    else if (action === "getStaffAttendanceByDateRange") result = getStaffAttendanceByDateRange(body.username, body.dateStart, body.dateEnd);
    else if (action === "getAllLeaveLog")                 result = getAllLeaveLog();
    else if (action === "getLeaveTypes")                 result = getLeaveTypes();
    else if (action === "getLeaveValidationConfig")      result = getLeaveValidationConfig();
    else if (action === "getLeaveBalance")               result = getLeaveBalance(body.staffName);
    else if (action === "processCuti")                   result = processCuti(body.formData);
    else if (action === "processLeaveStatus")            result = processLeaveStatus(body.rowIndex, body.status);
    else if (action === "setStaffLate")                  result = setStaffLate(body.nama);
    else if (action === "getSystemConfig")               result = getSystemConfig();
    else if (action === "saveSystemConfig")              result = saveSystemConfig(body.payload);
    else if (action === "generateNewToken")              result = generateNewToken();
    else if (action === "getStaffManagementData")        result = getStaffManagementData();
    else if (action === "saveStaffData")                 result = saveStaffData(body.payload);
    else if (action === "getOutstationList")             result = getOutstationList();
    else if (action === "saveOutstation")                result = saveOutstation(body.payload);
    else if (action === "deleteOutstation")              result = deleteOutstation(body.rowIndex);
    else if (action === "processOutstationAutoClockIn")  result = processOutstationAutoClockIn();
    else if (action === "setupOutstationTrigger")        result = setupOutstationTrigger(body.triggerTime);
    else if (action === "saveOutstationTriggerTime_web") result = saveOutstationTriggerTime_web(body.triggerTime);
    else if (action === "getOutstationTriggerTime")      result = getOutstationTriggerTime();
    else if (action === "changeLeaveType")               result = changeLeaveType(body.rowIndex, body.newLeaveType, body.staffName);
    else if (action === "getHistoryRange")               result = getHistoryRange(body.dates);
    else result = { status: "ERROR", message: "Unknown action: " + action };
  } catch (err) {
    result = { status: "ERROR", message: "Router error: " + err.toString() };
  }
  output.setContent(JSON.stringify(result));
  return output;}

// ==========================================
// Triggers.gs - (Automasi & Menu)
// ==========================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ WAZZA MENU')
    .addItem('🔄 Set Auto Checkout (Ikut Config B6)', 'setupAutoCheckoutTrigger')
    .addSeparator()
    .addItem('🌙 Set Auto-Refresh Token (Setiap 12 Malam)', 'setupMidnightTokenTrigger')
    .addSeparator()
    .addItem('🗺️ Proses Auto Clock-In Outstation (Hari Ini)', 'processOutstationAutoClockIn')
    .addItem('⚙️ Setup Auto Trigger Outstation (Harian)', 'setupOutstationTriggerFromMenu')
    .addToUi();
}

function setupAutoCheckoutTrigger() {
  const ui = SpreadsheetApp.getUi();
  const configVal = CONFIG_SHEET.getRange("B6").getValue();
  let targetHour = 18; let targetMinute = 0; 

  try {
    if (configVal instanceof Date) {
      targetHour = configVal.getHours(); targetMinute = configVal.getMinutes();
    } else {
      let timeParts = String(configVal).split(":"); 
      targetHour = parseInt(timeParts[0]);
      if (timeParts.length > 1) targetMinute = parseInt(timeParts[1]);
    }
  } catch (e) { ui.alert("Format masa salah."); return; }

  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runAutoCheckout') ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('runAutoCheckout').timeBased().everyDays(1).atHour(targetHour).nearMinute(targetMinute).create();
  let minitCantik = (targetMinute < 10 ? '0' : '') + targetMinute;
  ui.alert(`✅ BERJAYA!\n\nAuto-Checkout set pada jam ${targetHour}:${minitCantik}.`);
}

function runAutoCheckout() {
  const configVal = CONFIG_SHEET.getRange("B6").getValue(); 
  let autoTimestamp = new Date(); 
  
  if (configVal instanceof Date) {
    autoTimestamp.setHours(configVal.getHours()); autoTimestamp.setMinutes(configVal.getMinutes()); autoTimestamp.setSeconds(0);
  } else if (typeof configVal === 'string' && configVal.includes(":")) {
    let parts = configVal.split(":");
    autoTimestamp.setHours(parseInt(parts[0])); autoTimestamp.setMinutes(parseInt(parts[1])); autoTimestamp.setSeconds(0);
  } else {
    autoTimestamp.setHours(18); autoTimestamp.setMinutes(0); autoTimestamp.setSeconds(0);
  }

  const data = LOG_SHEET.getDataRange().getValues();
  const today = new Date();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = new Date(row[0]); 
    const masaKeluar = row[9]; 
    
    if (rowDate.getDate() === today.getDate() && rowDate.getMonth() === today.getMonth() && rowDate.getFullYear() === today.getFullYear() && (masaKeluar === "" || masaKeluar === null)) {
        const cell = LOG_SHEET.getRange(i + 1, 10);
        cell.setValue(autoTimestamp);
        cell.setNumberFormat("HH:mm"); 
        LOG_SHEET.getRange(i + 1, 11).setValue("AUTO-SYSTEM");
        LOG_SHEET.getRange(i + 1, 13).setValue("CLOCK-OUT");
    }
  }
}

function setupMidnightTokenTrigger() {
  const ui = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'generateNewToken') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('generateNewToken').timeBased().everyDays(1).atHour(0).nearMinute(0).create();
  ui.alert(`✅ SIAP!\n\nToken QR akan bertukar automatik setiap hari jam 12:00 Malam.`);
}

// ==========================================
// Auth.gs - (Keselamatan & Log Masuk)
// ==========================================

//  staff
function verifyLogin(u, p) {
  const data = USER_SHEET.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    let ic   = String(data[i][1]).trim();
    let nama = String(data[i][2]).trim();
    let user = String(data[i][0]).trim();
    // IC-only mode — u kosong, padankan IC sahaja
    if (!u || u === "") {
      if (ic === String(p).trim()) return { status: 'SUCCESS', nama: nama };
    } else {
      if ((user === u || nama === u) && ic === String(p).trim()) return { status: 'SUCCESS', nama: nama };
    }
  }
  return { status: 'ERROR', message: 'IC tidak ditemui atau tidak sah.' };
}

// Gabung login + dashboard dalam 1 GAS call — potong 1 network round trip
function loginAndGetDashboard(ic) {
  const loginResult = verifyLogin("", ic);
  if (loginResult.status !== 'SUCCESS') return loginResult;
  const dashResult = getStaffDashboardData(loginResult.nama);
  if (dashResult.status === 'SUCCESS') dashResult.nama = loginResult.nama;
  return dashResult;
}

// Phase 1 data sahaja — verify IC + profile + today + stats (laju, last 90 rows)
function loginWithTodayStatus(ic) {
  const loginResult = verifyLogin("", ic);
  if (loginResult.status !== 'SUCCESS') return loginResult;
  return getQuickDashboardData(loginResult.nama);
}

// Sama macam atas tapi tanpa verify IC — untuk returning user
function getQuickDashboardData(username) {
  try {
    const masterSheet = SS.getSheetByName("Master_Staff");
    const masterData = masterSheet.getDataRange().getValues();
    let profile = { name: username, role: "Staff", id: "0000", pic: "" };
    for (let i = 1; i < masterData.length; i++) {
      if (masterData[i][1] == username) {
        profile.id = masterData[i][0]; profile.name = masterData[i][1];
        profile.role = masterData[i][2]; profile.pic = masterData[i][3]; break;
      }
    }

    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRowLog = logSheet.getLastRow();
    const startRow = Math.max(2, lastRowLog - 90 + 1);
    let logData = [];
    if (lastRowLog > 1) logData = logSheet.getRange(startRow, 1, lastRowLog - startRow + 1, 10).getValues();

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let todayLog = null;
    let monthlyStats = { present: 0, late: 0, leave: 0 };

    for (let i = logData.length - 1; i >= 0; i--) {
      if (!logData[i][0] || logData[i][2] != username) continue;
      let d = new Date(logData[i][0]);
      if (isNaN(d.getTime())) continue;
      let dateStr = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
      let inStr   = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "HH:mm");
      let status  = logData[i][3];
      let masaKeluar = logData[i][9]; let outStr = "--:--";
      if (masaKeluar instanceof Date && !isNaN(masaKeluar.getTime())) {
        outStr = Utilities.formatDate(masaKeluar, "Asia/Kuala_Lumpur", "HH:mm");
      } else if (masaKeluar && String(masaKeluar).includes(":")) {
        outStr = String(masaKeluar).replace("OUT:", "").trim();
      }
      if (dateStr === todayStr && !todayLog) {
        todayLog = { date: dateStr, status: status, in: inStr, out: outStr };
      }
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthlyStats.present++;
        if (String(status).toUpperCase().includes("LEWAT")) monthlyStats.late++;
      }
    }

    return { status: 'SUCCESS', nama: username, profile: profile, todayLog: todayLog, monthlyStats: monthlyStats };
  } catch(e) {
    return { status: 'ERROR', message: e.toString() };
  }
}

//  admin
function verifyAdminLogin(username, password) {
  const configData = CONFIG_SHEET.getDataRange().getValues();
  let validUser = "";
  let validPass = "";

  for (let i = 0; i < configData.length; i++) {
    let key = String(configData[i][0]).trim().toUpperCase(); 
    
    if (key === "ADMIN_USER") {
        validUser = String(configData[i][1]).trim();
    }
    
    if (key === "ADMIN_PASS" || key === "ADMINS_PASS") {
        validPass = String(configData[i][1]).trim();
    }
  }

  if (username === validUser && password === validPass) {
    return { status: 'SUCCESS' };
  } else {
    return { status: 'ERROR', message: 'Username atau Password Salah!' };
  }
}


// ==========================================
// Attendance.gs -  (Logik Kehadiran & Pengesanan)
// ==========================================

//  (Clock-In)
function processScan(payload) {
  const configMasa = CONFIG_SHEET.getRange("B4:B5").getValues();
  const rawStart = configMasa[0][0]; 
  const rawEnd = configMasa[1][0];   

  const nowStr = Utilities.formatDate(new Date(), "GMT+8", "HH:mm");

  if (rawStart && rawEnd) {
    const formatTime = (input) => {
      if (input instanceof Date) return Utilities.formatDate(input, "GMT+8", "HH:mm");
      return String(input).trim().substring(0, 5);
    };

    const startTime = formatTime(rawStart);
    const endTime = formatTime(rawEnd);

    if (nowStr < startTime || nowStr > endTime) {
      return { status: 'ERROR', message: 'GAGAL: Waktu Clock-In sudah TAMAT!\n(' + nowStr + '). Sila guna QR Merah.' };
    }
  }

  const serverToken = CONFIG_SHEET.getRange("B2").getValue();
  if (String(serverToken).trim() !== String(payload.token).trim()) {
    return { status: 'ERROR', message: 'QR Code Tamat Tempoh / Salah Tarikh!' };
  }

  // --- BACA SETTING GEOFENCING & LATE THRESHOLD ---
  const allConfig = CONFIG_SHEET.getDataRange().getValues();
  let offLat = "", offLng = "", offRad = 0, lateStart = "";
  let _lateStartFound = false;
  for (let i = 0; i < allConfig.length; i++) {
      let key = String(allConfig[i][0]).trim().toUpperCase();
      if (key === "OFFICE_LAT") offLat = parseFloat(allConfig[i][1]);
      if (key === "OFFICE_LNG") offLng = parseFloat(allConfig[i][1]);
      if (key === "OFFICE_RADIUS") offRad = parseInt(allConfig[i][1]);
      if (key === "LATE-START" && !_lateStartFound) {
        let lv = allConfig[i][1];
        lateStart = lv instanceof Date ? Utilities.formatDate(lv, "GMT+8", "HH:mm") : String(lv).trim().substring(0, 5);
        _lateStartFound = true;
      }
  }

  // --- LOGIK HALANGAN RADIUS (GEOFENCING) ---
  if (offLat && offLng && offRad > 0 && !isWfhToday() && !isOutstationToday(payload.nama)) {
      if (!payload.lat || !payload.lng) {
          return { status: 'ERROR', message: 'GAGAL: Sila pastikan GPS/Location phone anda dibuka untuk sahkan lokasi pejabat.' };
      }

      let distance = getDistanceInMeters(payload.lat, payload.lng, offLat, offLng);

      if (distance > offRad) {
          return { status: 'ERROR', message: `GAGAL: Anda berada di luar radius pejabat!\nJarak anda: ${Math.round(distance)}m\nHad Sah: ${offRad}m` };
      }
  }

  const today = new Date();
  const data = LOG_SHEET.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const rowDate = new Date(row[0]); 
    const rowName = row[2];          
    
    if (rowName === payload.nama && 
        rowDate.getDate() === today.getDate() &&
        rowDate.getMonth() === today.getMonth() &&
        rowDate.getFullYear() === today.getFullYear()) {
        return { status: 'ERROR', message: 'Anda sudah scan kehadiran hari ini! Jumpa esok.' };
    }
  }

  // --- SEMAK LAMBAT ---
  const isLate = lateStart.length === 5 && nowStr > lateStart;
  if (isLate && (!payload.sebabLambat || String(payload.sebabLambat).trim() === "")) {
    return {
      status: 'LATE_PROMPT',
      lateTime: nowStr,
      lateStart: lateStart,
      message: 'Anda lewat daripada masa yang ditetapkan (' + lateStart + '). Sila berikan sebab kelewatan.'
    };
  }

  let alamat = "Tiada Lokasi";
  if (payload.lat && payload.lng) {
    try {
      const response = Maps.newGeocoder().reverseGeocode(payload.lat, payload.lng);
      if (response.status === 'OK') alamat = response.results[0].formatted_address;
    } catch (e) {}
  }

  const statusMasuk = isLate ? "LEWAT" : "CLOCK-IN";
  const notaSebab   = isLate ? "Lewat. Sebab: " + String(payload.sebabLambat).trim() : "Auto-Scan";

  LOG_SHEET.appendRow([
    new Date(),
    payload.token,
    payload.nama,
    statusMasuk,
    payload.lat + "," + payload.lng,
    alamat,
    payload.ip,
    payload.device,
    notaSebab
  ]);

  _markOutstationDoneIfExists(payload.nama);

  const msgOut = isLate ? 'Lewat: ' + payload.nama : 'Hadir: ' + payload.nama;
  return { status: 'SUCCESS', isLate: isLate, message: msgOut, time: new Date().toLocaleTimeString() };
}

function _markOutstationDoneIfExists(nama) {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < data.length; i++) {
      let staffNama = String(data[i][1]).trim();
      let tarikhRaw = data[i][2];
      let tarikhStr = tarikhRaw instanceof Date
        ? Utilities.formatDate(tarikhRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(tarikhRaw).trim();
      let status = String(data[i][6] || "PENDING");
      if (staffNama === nama && tarikhStr === todayStr && status !== "DONE") {
        sheet.getRange(i + 2, 7).setValue("DONE");
      }
    }
  } catch(e) {}
}

//  (Clock-Out)
function processClockOut(payload) {
  // --- BACA SETTING GEOFENCING ---
  const allConfig = CONFIG_SHEET.getDataRange().getValues();
  let offLat = "", offLng = "", offRad = 0;
  for (let i = 0; i < allConfig.length; i++) {
      let key = String(allConfig[i][0]).trim().toUpperCase();
      if (key === "OFFICE_LAT") offLat = parseFloat(allConfig[i][1]);
      if (key === "OFFICE_LNG") offLng = parseFloat(allConfig[i][1]);
      if (key === "OFFICE_RADIUS") offRad = parseInt(allConfig[i][1]);
  }

  // --- LOGIK HALANGAN RADIUS (GEOFENCING) UNTUK CLOCK-OUT ---
  if (offLat && offLng && offRad > 0 && !isWfhToday() && !isOutstationToday(payload.nama)) {
      if (!payload.lat || !payload.lng) {
          return { status: 'ERROR', message: 'GAGAL: Sila pastikan GPS/Location phone anda dibuka untuk sahkan lokasi pejabat.' };
      }

      let distance = getDistanceInMeters(payload.lat, payload.lng, offLat, offLng);

      if (distance > offRad) {
          return { status: 'ERROR', message: `GAGAL: Anda berada di luar radius pejabat!\nJarak anda: ${Math.round(distance)}m\nHad Sah: ${offRad}m` };
      }
  }

  const data = LOG_SHEET.getDataRange().getValues();
  const today = new Date();
  let foundRowIndex = -1;

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const rowDate = new Date(row[0]); 
    const rowName = row[2];           
    
    if (rowName === payload.nama && 
        rowDate.getDate() === today.getDate() &&
        rowDate.getMonth() === today.getMonth() &&
        rowDate.getFullYear() === today.getFullYear()) {
       
       foundRowIndex = i + 1; 
       const existingOut = LOG_SHEET.getRange(foundRowIndex, 10).getValue(); 
       
       if (existingOut && existingOut !== "") {
         let masaLama = existingOut instanceof Date ? 
             Utilities.formatDate(existingOut, "Asia/Kuala_Lumpur", "HH:mm") : existingOut;
         return { status: 'WARNING', message: 'Anda sudah Clock-Out sebelum ini pada jam: ' + masaLama };
       }
       break; 
    }
  }

  if (foundRowIndex === -1) {
    return { status: 'ERROR', message: 'RALAT: Anda belum Clock-In hari ini!' };
  }

  const now = new Date();
  const cellOut = LOG_SHEET.getRange(foundRowIndex, 10); 
  cellOut.setValue(now);
  cellOut.setNumberFormat("HH:mm:ss"); 
  
  let alamat = "Tiada Lokasi";
  let koordinat = ""; 

  if (payload.lat && payload.lng) {
    koordinat = payload.lat + ", " + payload.lng; 
    try {
      const response = Maps.newGeocoder().reverseGeocode(payload.lat, payload.lng);
      if (response.status === 'OK') alamat = response.results[0].formatted_address;
    } catch (e) {}
  }
  
  LOG_SHEET.getRange(foundRowIndex, 11).setValue("OUT: " + alamat); 
  LOG_SHEET.getRange(foundRowIndex, 12).setValue(koordinat);        

  const configVal = CONFIG_SHEET.getRange("B6").getValue(); 
  let targetHour = 18;  
  let targetMinute = 0; 
  
  if (configVal instanceof Date) {
    targetHour = configVal.getHours();
    targetMinute = configVal.getMinutes();
  } else if (typeof configVal === 'string' && configVal.includes(":")) {
    let parts = configVal.split(":");
    targetHour = parseInt(parts[0]);
    if (parts.length > 1) targetMinute = parseInt(parts[1]);
  }

  let officialEndTime = new Date();
  officialEndTime.setHours(targetHour, targetMinute, 0, 0);

  let statusKeluar = "CLOCK-OUT"; 

  if (now < officialEndTime) {
      statusKeluar = "CLOCK-OUT AWAL"; 
  }

  LOG_SHEET.getRange(foundRowIndex, 13).setValue(statusKeluar);

  let timeString = Utilities.formatDate(now, "Asia/Kuala_Lumpur", "HH:mm:ss");
  return { status: 'SUCCESS', message: 'Jumpa Esok!', time: timeString };
}

// Helper: Formula Haversine untuk kira jarak sebenar dalam Meter
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // Radius bumi dalam meter
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const deltaP = (lat2 - lat1) * Math.PI / 180;
  const deltaL = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaP/2) * Math.sin(deltaP/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(deltaL/2) * Math.sin(deltaL/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

function setStaffLate(namaStaff) {
  const logSheet = SS.getSheetByName("Log_Kehadiran");
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "Asia/Kuala_Lumpur", "HH:mm");
  logSheet.appendRow([ now, "ADMIN-OVERRIDE", namaStaff, "LEWAT (MANUAL)", "", "Ditanda oleh Admin", "Admin Dashboard", "Manual", "Manual Override" ]);
  return "SUCCESS";
}

// ==========================================
// Leave.gs - (Pengurusan Cuti)
// ==========================================

function processCuti(form) {
  const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
  const logSheet = SS.getSheetByName("Log_Kehadiran");
  const configSheet = SS.getSheetByName("Config"); 
  
  if (!cutiSheet) {
    let newSheet = SS.insertSheet("Log_Cuti_Lewat");
    newSheet.appendRow(["Timestamp", "Nama_staf", "Jenis_Laporan", "Tarikh_Kejadian", "Sebab/Alasan", "IP_Address", "Status_Lulus", "Lokasi_Koordinat", "Lokasi_Alamat", "Lampiran_Fail"]);
  }

  let startDate = new Date(form.tarikhMula);
  let endDate = new Date(form.tarikhTamat);
  startDate.setHours(0,0,0,0);
  endDate.setHours(0,0,0,0);

  let isLambat = String(form.jenis).includes("Lambat");

  if (isLambat) {
     let today = new Date();
     today.setHours(0,0,0,0);
     startDate = new Date(today);
     endDate = new Date(today);

     const logData = logSheet.getDataRange().getValues();
     for (let i = logData.length - 1; i >= 1; i--) {
        let rowDate = new Date(logData[i][0]);
        let rowName = logData[i][2];
        if (rowName === form.nama && rowDate.getDate() === startDate.getDate() && rowDate.getMonth() === startDate.getMonth() && rowDate.getFullYear() === startDate.getFullYear()) {
            return { status: 'ERROR', message: 'TIDAK SAH: Anda sudah ada rekod kehadiran hari ini!' };
        }
     }
  } 
  else {
     const cutiData = cutiSheet.getDataRange().getValues();
     let tempDate = new Date(startDate);
     while (tempDate <= endDate) {
         let tempTime = tempDate.getTime();
         for (let i = 1; i < cutiData.length; i++) {
             let logNama = cutiData[i][1];
             let logJenis = String(cutiData[i][2]);
             let logTarikh = new Date(cutiData[i][3]); logTarikh.setHours(0,0,0,0);
             let logStatus = cutiData[i][6];
             
             if (logNama === form.nama && logTarikh.getTime() === tempTime && !logJenis.includes("Lambat") && logStatus !== "DITOLAK") {
                 let dStr = Utilities.formatDate(tempDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
                 return { status: 'ERROR', message: `RALAT TARIKH: Anda telah membuat permohonan cuti pada tarikh ${dStr} yang sedang Diproses atau telah Diluluskan.` };
             }
         }
         tempDate.setDate(tempDate.getDate() + 1);
     }
  }

  // --- SEMAK BAKI CUTI ---
  if (!isLambat) {
    var jenisUpper = String(form.jenis).trim().toUpperCase();
    var leavePool = null;
    var isHalfDay = false;
    if      (jenisUpper === "AL")  { leavePool = "AL"; }
    else if (jenisUpper === "HAL") { leavePool = "AL"; isHalfDay = true; }
    else if (jenisUpper === "MC")  { leavePool = "MC"; }
    else if (jenisUpper === "HL")  { leavePool = "HL"; }
    else if (jenisUpper === "ML")  { leavePool = "ML"; }
    else if (jenisUpper === "PL")  { leavePool = "PL"; }
    else if (jenisUpper === "EL")  { leavePool = "EL"; }
    else if (jenisUpper === "HEL") { leavePool = "EL"; isHalfDay = true; }
    else if (jenisUpper === "BL")  { leavePool = "BL"; }

    if (leavePool) {
      var balResult = getLeaveBalance(form.nama);
      if (balResult.status === "SUCCESS") {
        var poolData = balResult.data[leavePool];
        if (poolData && poolData.balance !== null) {
          var daysRequested = isHalfDay ? 0.5 : (Math.round((endDate - startDate) / (1000 * 3600 * 24)) + 1);
          if (poolData.balance < daysRequested) {
            return { status: 'ERROR', message: 'BAKI CUTI ' + leavePool + ' TIDAK MENCUKUPI. Baki: ' + poolData.balance + ' hari. Dimohon: ' + daysRequested + ' hari.' };
          }
        }
      }
    }
  }

  let koordinat = "";
  let alamatMaps = "Tiada Lokasi / GPS Ditutup";
  if (form.lat && form.lng) {
     koordinat = form.lat + ", " + form.lng;
     try {
       const response = Maps.newGeocoder().reverseGeocode(form.lat, form.lng);
       if (response.status === 'OK') {
           alamatMaps = response.results[0].formatted_address;
       }
     } catch (e) {}
  }

  let fileUrl = "Tiada";
  if (form.fileData && form.fileData !== "") {
    try {
      let folderId = configSheet.getRange("B7").getValue().trim(); 
      let folder = DriveApp.getFolderById(folderId);
      
      let decoded = Utilities.base64Decode(form.fileData);
      
      let cleanName = String(form.nama).replace(/[^a-zA-Z0-9]/g, ""); 
      let timeStampNow = Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyyMMdd_HHmmss");
      let newFileName = timeStampNow + "_" + cleanName + "_" + form.fileName;
      
      let blob = Utilities.newBlob(decoded, form.mimeType, newFileName);
      let file = folder.createFile(blob);
      
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    } catch (e) {
      console.log("Error Upload File: " + e);
      fileUrl = "Error Upload: " + e.message;
    }
  }

  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
      let statusCuti = ""; 
      let insertDateObj = new Date(currentDate);

      if (isLambat) {
        statusCuti = "DILULUSKAN"; 
        let currentNow = new Date(); 
        let injectDate = new Date(currentDate);
        injectDate.setHours(currentNow.getHours(), currentNow.getMinutes(), currentNow.getSeconds());

        logSheet.appendRow([
          injectDate, "AUTO-PORTAL", form.nama, "LEWAT (MANUAL)", koordinat, alamatMaps, form.ip, "Portal Staf", "Sebab: " + form.sebab      
        ]);
      }

      cutiSheet.appendRow([
        new Date(), form.nama, form.jenis, insertDateObj, form.sebab, form.ip, statusCuti, koordinat, alamatMaps, fileUrl
      ]);

      currentDate.setDate(currentDate.getDate() + 1);
  }

  return { status: 'SUCCESS' };
}

function processLeaveStatus(rowIndex, status, reason) {
  const sheet = SS.getSheetByName("Log_Cuti_Lewat");
  sheet.getRange(rowIndex, 7).setValue(status);
  if (status === "DITOLAK" && reason) {
    sheet.getRange(rowIndex, 11).setValue(reason);
  }
  return "SUCCESS";
}

function getLeaveValidationConfig() {
  try {
    const configData = CONFIG_SHEET.getDataRange().getValues();
    let rules = { al_advance: 0, al_streak_doc_req: 0, mc_streak_doc_req: 0 };
    for (let i = 0; i < configData.length; i++) {
      let key = String(configData[i][0]).trim().toLowerCase();
      let val = configData[i][1];
      if (key === "al_advance")        rules.al_advance        = parseInt(val) || 0;
      if (key === "al_streak_doc_req") rules.al_streak_doc_req = parseInt(val) || 0;
      if (key === "mc_streak_doc_req") rules.mc_streak_doc_req = parseInt(val) || 0;
    }
    return rules;
  } catch(e) {
    return { al_advance: 0, al_streak_doc_req: 0, mc_streak_doc_req: 0 };
  }
}

function getLeaveBalance(staffName) {
  try {
    const masterSheet = SS.getSheetByName("Master_Staff");
    const masterData = masterSheet.getDataRange().getValues();
    let limits = { AL: 0, MC: 0, HL: 0, ML: 0, PL: 0, EL: 0, BL: 0 };
    for (let i = 1; i < masterData.length; i++) {
      if (String(masterData[i][1]).trim() === String(staffName).trim()) {
        limits.AL = parseInt(masterData[i][6])  || 0;
        limits.MC = parseInt(masterData[i][7])  || 0;
        limits.HL = parseInt(masterData[i][8])  || 0;
        limits.ML = parseInt(masterData[i][9])  || 0;
        limits.PL = parseInt(masterData[i][10]) || 0;
        limits.EL = parseInt(masterData[i][11]) || 0;
        limits.BL = parseInt(masterData[i][12]) || 0;
        break;
      }
    }

    const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
    const lastRow = cutiSheet.getLastRow();
    const currentYear = new Date().getFullYear();
    let used = { AL: 0, MC: 0, HL: 0, ML: 0, PL: 0, EL: 0, BL: 0, UL: 0 };

    if (lastRow > 1) {
      const cutiData = cutiSheet.getRange(2, 1, lastRow - 1, 7).getValues();
      for (let i = 0; i < cutiData.length; i++) {
        if (String(cutiData[i][1]).trim() !== String(staffName).trim()) continue;
        if (String(cutiData[i][6]).trim() !== "DILULUSKAN") continue;
        let tDate = new Date(cutiData[i][3]);
        if (tDate.getFullYear() !== currentYear) continue;
        let jenis = String(cutiData[i][2]).trim().toUpperCase();
        if      (jenis === "AL")  used.AL += 1;
        else if (jenis === "HAL") used.AL += 0.5;
        else if (jenis === "MC")  used.MC += 1;
        else if (jenis === "HL")  used.HL += 1;
        else if (jenis === "ML")  used.ML += 1;
        else if (jenis === "PL")  used.PL += 1;
        else if (jenis === "EL")  used.EL += 1;
        else if (jenis === "HEL") used.EL += 0.5;
        else if (jenis === "BL")  used.BL += 1;
        else if (jenis === "UL")  used.UL += 1;
        else if (jenis === "HUL") used.UL += 0.5;
      }
    }

    let balance = {};
    ["AL","MC","HL","ML","PL","EL","BL"].forEach(function(t) {
      balance[t] = {
        limit:   limits[t],
        used:    used[t],
        balance: (limits[t] === 0 || limits[t] === -1) ? null : Math.max(0, limits[t] - used[t]),
        unlimited: limits[t] === -1
      };
    });
    balance["UL"] = { limit: null, used: used.UL, balance: null, unlimited: true };
    return { status: "SUCCESS", data: balance };
  } catch(e) {
    return { status: "ERROR", message: e.toString() };
  }
}

const DATAPREP_SHEET = SS.getSheetByName("dataprep");
function getLeaveTypes() {
  const data = DATAPREP_SHEET.getDataRange().getValues();
  let leaveList = ["Datang Lambat 🐢"]; 
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0] !== "") leaveList.push(data[i][0]);
  }
  return leaveList;
}

// ==========================================
// Dashboard.gs - (Paparan Data)
// ==========================================


function getStaffDashboardData(username) {
  try {
    const masterSheet = SS.getSheetByName("Master_Staff");
    const masterData = masterSheet.getDataRange().getValues();
    let profile = { name: "Tetamu", role: "Staff", id: "0000", pic: "https://via.placeholder.com/150" };
    for (let i = 1; i < masterData.length; i++) {
      if (masterData[i][1] == username) {
        profile.id = masterData[i][0]; profile.name = masterData[i][1]; profile.role = masterData[i][2]; profile.pic = masterData[i][3]; break;
      }
    }

    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRowLog = logSheet.getLastRow();
    let logData = [];
    if (lastRowLog > 1) logData = logSheet.getRange(2, 1, lastRowLog - 1, 10).getValues();

    let allAttendance = []; // semua rekod staff ni — untuk client-side filter
    let myLogs = [];        // last 10 — untuk dashboard view
    let todayLog = null;
    let monthlyStats = { present: 0, late: 0, leave: 0 };

    const today = new Date(); today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const todayDateString = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "dd/MM/yyyy");

    for (let i = logData.length - 1; i >= 0; i--) {
      if (!logData[i][0] || logData[i][0] === "") continue;

      if (logData[i][2] == username) {
         let d = new Date(logData[i][0]);
         if (isNaN(d.getTime())) continue;

         let dateStr   = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
         let dateRaw   = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "yyyy-MM-dd"); // untuk filter
         let inStr     = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "HH:mm");
         let statusReal = logData[i][3];

         let masaKeluar = logData[i][9]; let outStr = "--:--";
         if (masaKeluar instanceof Date && !isNaN(masaKeluar.getTime())) {
             outStr = Utilities.formatDate(masaKeluar, "Asia/Kuala_Lumpur", "HH:mm");
         } else if (masaKeluar && String(masaKeluar).includes(":")) {
             outStr = String(masaKeluar).replace("OUT:", "").trim();
         }

         let rec = { date: dateStr, dateRaw: dateRaw, status: statusReal, in: inStr, out: outStr };
         allAttendance.push(rec);
         if (myLogs.length < 10) myLogs.push(rec);

         if (dateStr === todayDateString && !todayLog) todayLog = rec;

         if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
             monthlyStats.present++;
             if (String(statusReal).toUpperCase().includes("LEWAT")) monthlyStats.late++;
         }
      }
    }

    const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
    const lastRowCuti = cutiSheet.getLastRow();
    let cutiData = [];
    if (lastRowCuti > 1) cutiData = cutiSheet.getRange(2, 1, lastRowCuti - 1, 11).getValues();

    let myLeave = [];

    for (let i = cutiData.length - 1; i >= 0; i--) {
      if (!cutiData[i][3] || cutiData[i][3] === "") continue;

      let isLambat = String(cutiData[i][2]).toLowerCase().includes("lambat");
      if (cutiData[i][1] == username && !isLambat) {
         let d = new Date(cutiData[i][3]);
         if (isNaN(d.getTime())) continue;

         let dateStr = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
         let statusRaw = cutiData[i][6];
         let linkFail = cutiData[i][9];
         if (!statusRaw || statusRaw === "") statusRaw = "DALAM PROSES";

         let leaveObj = { type: cutiData[i][2], date: dateStr, dateObj: d.getTime(), reason: cutiData[i][4], status: statusRaw, attachment: linkFail, rejectReason: cutiData[i][10] || "" };
         myLeave.push(leaveObj);

         if (statusRaw === "DILULUSKAN" && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
             monthlyStats.leave++;
         }
      }
    }

    // Upcoming: DILULUSKAN (tarikh >= hari ini) + semua PROSES, susun ascending
    let upcomingLeaves = myLeave
      .filter(function(l) {
        if (l.status === "DILULUSKAN") return l.dateObj >= today.getTime();
        if (l.status === "DALAM PROSES") return true;
        return false;
      })
      .sort(function(a, b) { return a.dateObj - b.dateObj; })
      .map(function(l) { return { type: l.type, date: l.date, reason: l.reason, status: l.status }; });

    var balResult = getLeaveBalance(username);
    var leaveBalance = balResult.status === "SUCCESS" ? balResult.data : null;
    return { status: 'SUCCESS', profile: profile, attendance: myLogs, allAttendance: allAttendance, leave: myLeave, todayLog: todayLog, monthlyStats: monthlyStats, upcomingLeaves: upcomingLeaves, leaveBalance: leaveBalance };
  
  } catch(error) {
    return { status: 'ERROR', message: "Ralat Pelayan: " + error.toString() };
  }
}

function getAdminDashboardData(targetDateRaw) {
  let targetDate = new Date();
  let isHistoryMode = false;
  if (targetDateRaw) { targetDate = new Date(targetDateRaw); isHistoryMode = true; }
  const dateStr = Utilities.formatDate(targetDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
  
  const masterSheet = SS.getSheetByName("Master_Staff");
  const masterData = masterSheet.getDataRange().getValues();
  let combinedStaffList = new Set();
  
  let excludedFromTracker = new Set();
  for (let i = 1; i < masterData.length; i++) {
    let nama = masterData[i][1];
    let statusPekerja = masterData[i][5] ? String(masterData[i][5]).trim().toUpperCase() : "";
    let paparTracker = masterData[i][13] ? String(masterData[i][13]).trim().toUpperCase() : "YES";

    if (nama && String(nama).trim() !== "") {
        if (paparTracker === "NO") { excludedFromTracker.add(nama); continue; }
        if (statusPekerja === "AKTIF") combinedStaffList.add(nama);
    }
  }

  const logSheet = SS.getSheetByName("Log_Kehadiran");
  const lastRowLog = logSheet.getLastRow();
  const limit = isHistoryMode ? 3000 : 1000; 
  const startRow = Math.max(2, lastRowLog - limit + 1);
  let logData = [];
  if (lastRowLog > 1) logData = logSheet.getRange(startRow, 1, (lastRowLog - startRow + 1), 12).getValues();

  let attendanceMap = {};
  for (let i = 0; i < logData.length; i++) {
    let rowDate = new Date(logData[i][0]);
    let rowDateStr = Utilities.formatDate(rowDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
    
    if (rowDateStr === dateStr) {
      let nama = logData[i][2];
      
      if (excludedFromTracker.has(nama)) continue;
      combinedStaffList.add(nama);
      
      let masaMasukObj = new Date(logData[i][0]);
      let masaMasukStr = Utilities.formatDate(masaMasukObj, "Asia/Kuala_Lumpur", "HH:mm");
      let rawOut = logData[i][9]; let masaKeluarStr = "-";
      if (rawOut instanceof Date) masaKeluarStr = Utilities.formatDate(rawOut, "Asia/Kuala_Lumpur", "HH:mm");
      else if (rawOut && String(rawOut).trim() !== "") masaKeluarStr = String(rawOut).replace("OUT:", "").trim();

      attendanceMap[nama] = {
        masaMasuk: masaMasukStr, masaKeluar: masaKeluarStr, coordsIn: logData[i][4], coordsOut: logData[i][11],
        alamatIn: logData[i][5], alamatOut: logData[i][10], status: logData[i][3]
      };
    }
  }

  const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
  const lastRowCuti = cutiSheet.getLastRow();
  let cutiData = [];
  if (lastRowCuti > 1) cutiData = cutiSheet.getRange(2, 1, lastRowCuti - 1, 10).getValues(); 

  let approvedLeaves = []; 
  let cutiTodayCount = 0;  
  const todayReset = new Date(targetDate); todayReset.setHours(0,0,0,0);
  
  let staffOnLeaveToday = {}; 

  for (let i = 0; i < cutiData.length; i++) {
    let tarikhCutiRaw = new Date(cutiData[i][3]);
    let statusLulus = cutiData[i][6]; 
    let jenisLaporan = cutiData[i][2]; 
    let namaStaffCuti = cutiData[i][1];
    let isLambat = String(jenisLaporan).toLowerCase().includes("lambat");
    
    if (statusLulus === "DILULUSKAN" && !isLambat) {
       let tStr = Utilities.formatDate(tarikhCutiRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd"); 
       approvedLeaves.push({ title: namaStaffCuti, start: tStr, type: jenisLaporan }); 
       
       let tCheck = new Date(tarikhCutiRaw); tCheck.setHours(0,0,0,0);
       if (tCheck.getTime() === todayReset.getTime()) {
           // Hanya dihitung jika staf tersebut ada dalam daftar list hari ini
           if (combinedStaffList.has(namaStaffCuti)) {
               cutiTodayCount++;
               staffOnLeaveToday[namaStaffCuti] = jenisLaporan; 
           }
       }
    }
  }

  let finalAttendanceList = [];
  let presentCount = 0; let lateCount = 0; 
  Array.from(combinedStaffList).sort().forEach(name => {
    if (attendanceMap[name]) {
      presentCount++;
      var rawStatus = attendanceMap[name].status;
      var isLateStatus = rawStatus === "LEWAT (MANUAL)" || rawStatus === "LEWAT";
      if (isLateStatus) lateCount++;
      finalAttendanceList.push({
        nama: name, status: isLateStatus ? "LEWAT" : "HADIR",
        masaMasuk: attendanceMap[name].masaMasuk, masaKeluar: attendanceMap[name].masaKeluar,
        coordsIn: attendanceMap[name].coordsIn, coordsOut: attendanceMap[name].coordsOut,
        alamatIn: attendanceMap[name].alamatIn, alamatOut: attendanceMap[name].alamatOut  
      });
    } else {
      let statusTakHadir = staffOnLeaveToday[name] ? "CUTI - " + staffOnLeaveToday[name] : "TIDAK HADIR";
      
      finalAttendanceList.push({ 
          nama: name, status: statusTakHadir, 
          masaMasuk: "-", masaKeluar: "-", coordsIn: "", coordsOut: "", alamatIn: "", alamatOut: "" 
      });
    }
  });

  let pendingLeaves = [];
  if(!isHistoryMode) {
    var balCache = {};
    var poolMapGAS = { AL:'AL', HAL:'AL', MC:'MC', HL:'HL', ML:'ML', PL:'PL', EL:'EL', HEL:'EL', BL:'BL' };
    for (let i = 0; i < cutiData.length; i++) {
      let tarikhCutiRaw = new Date(cutiData[i][3]); let statusLulus = cutiData[i][6]; let jenisLaporan = cutiData[i][2]; let linkFail = cutiData[i][9];
      let todayReal = new Date(); todayReal.setHours(0,0,0,0);
      let isLambat = String(jenisLaporan).toLowerCase().includes("lambat");

      if (statusLulus !== "DILULUSKAN" && statusLulus !== "DITOLAK" && !isLambat) {
        let tStr = Utilities.formatDate(tarikhCutiRaw, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
        if (combinedStaffList.has(cutiData[i][1])) {
          var staffNm = cutiData[i][1];
          if (!balCache[staffNm]) balCache[staffNm] = getLeaveBalance(staffNm);
          var jenisUp = String(jenisLaporan).trim().toUpperCase();
          var pool = poolMapGAS[jenisUp] || null;
          var balInfo = (balCache[staffNm].status === "SUCCESS" && pool) ? balCache[staffNm].data[pool] : null;
          pendingLeaves.push({ rowIndex: i + 2, nama: staffNm, jenis: cutiData[i][2], tarikh: tStr, sebab: cutiData[i][4], attachment: linkFail, pool: pool, balanceInfo: balInfo });
        }
      }
    }
  }

  return { stats: { totalStaff: combinedStaffList.size, present: presentCount, late: lateCount, cuti: cutiTodayCount, date: dateStr }, attendance: finalAttendanceList, calendarEvents: approvedLeaves, pendingLeaves: pendingLeaves };
}

// Bulk history fetch — baca semua sheets SEKALI untuk N tarikh
// Jauh lebih laju vs N kali getAdminDashboardData
function getHistoryRange(dates) {
  try {
    if (!dates || dates.length === 0) return { status: "SUCCESS", results: [] };

    // Baca Master_Staff sekali
    const masterSheet = SS.getSheetByName("Master_Staff");
    const masterData = masterSheet.getDataRange().getValues();
    let baseStaffSet = new Set();
    for (let i = 1; i < masterData.length; i++) {
      let nama = masterData[i][1];
      let statusP = masterData[i][5] ? String(masterData[i][5]).trim().toUpperCase() : "";
      let paparTracker = masterData[i][13] ? String(masterData[i][13]).trim().toUpperCase() : "YES";
      if (nama && String(nama).trim() !== "" && statusP === "AKTIF" && paparTracker !== "NO") baseStaffSet.add(nama);
    }

    // Baca Log_Kehadiran sekali
    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRowLog = logSheet.getLastRow();
    let logData = [];
    if (lastRowLog > 1) {
      const startRow = Math.max(2, lastRowLog - 5000 + 1);
      logData = logSheet.getRange(startRow, 1, (lastRowLog - startRow + 1), 12).getValues();
    }

    // Baca Log_Cuti_Lewat sekali
    const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
    const lastRowCuti = cutiSheet.getLastRow();
    let approvedLeaves = []; // { nama, jenis, tarikhStr }
    if (lastRowCuti > 1) {
      const cutiData = cutiSheet.getRange(2, 1, lastRowCuti - 1, 10).getValues();
      for (let i = 0; i < cutiData.length; i++) {
        if (cutiData[i][6] !== "DILULUSKAN") continue;
        let jenis = String(cutiData[i][2]);
        if (jenis.toLowerCase().includes("lambat")) continue;
        let tRaw = cutiData[i][3];
        let tStr = tRaw instanceof Date
          ? Utilities.formatDate(tRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
          : String(tRaw).trim();
        approvedLeaves.push({ nama: cutiData[i][1], jenis: jenis, tarikhStr: tStr });
      }
    }

    // Proses setiap tarikh yang diminta
    let results = [];
    for (let d = 0; d < dates.length; d++) {
      let targetDateRaw = dates[d];
      let targetDate = new Date(targetDateRaw + 'T00:00:00');
      let dateStr = Utilities.formatDate(targetDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");

      // Bina attendance map untuk tarikh ni
      let staffOnDate = new Set(baseStaffSet);
      let attendanceMap = {};
      for (let i = 0; i < logData.length; i++) {
        let rowDate = new Date(logData[i][0]);
        let rowDateStr = Utilities.formatDate(rowDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
        if (rowDateStr !== dateStr) continue;
        let nama = logData[i][2];
        staffOnDate.add(nama);
        let masaMasukStr = Utilities.formatDate(rowDate, "Asia/Kuala_Lumpur", "HH:mm");
        let rawOut = logData[i][9];
        let masaKeluarStr = "-";
        if (rawOut instanceof Date) masaKeluarStr = Utilities.formatDate(rawOut, "Asia/Kuala_Lumpur", "HH:mm");
        else if (rawOut && String(rawOut).trim() !== "") masaKeluarStr = String(rawOut).replace("OUT:", "").trim();
        attendanceMap[nama] = {
          masaMasuk: masaMasukStr, masaKeluar: masaKeluarStr,
          coordsIn: logData[i][4], coordsOut: logData[i][11],
          alamatIn: logData[i][5], alamatOut: logData[i][10], status: logData[i][3]
        };
      }

      // Cuti yang diluluskan pada tarikh ni
      let staffOnLeave = {};
      let calendarEvents = [];
      for (let i = 0; i < approvedLeaves.length; i++) {
        let lv = approvedLeaves[i];
        calendarEvents.push({ title: lv.nama, start: lv.tarikhStr, type: lv.jenis });
        if (lv.tarikhStr === targetDateRaw && staffOnDate.has(lv.nama)) {
          staffOnLeave[lv.nama] = lv.jenis;
        }
      }

      // Bina senarai akhir
      let finalList = [];
      Array.from(staffOnDate).sort().forEach(function(name) {
        if (attendanceMap[name]) {
          let rawStatus = attendanceMap[name].status;
          let isLate = rawStatus === "LEWAT (MANUAL)" || rawStatus === "LEWAT";
          finalList.push({
            nama: name, status: isLate ? "LEWAT" : "HADIR",
            masaMasuk: attendanceMap[name].masaMasuk, masaKeluar: attendanceMap[name].masaKeluar,
            coordsIn: attendanceMap[name].coordsIn, coordsOut: attendanceMap[name].coordsOut,
            alamatIn: attendanceMap[name].alamatIn, alamatOut: attendanceMap[name].alamatOut
          });
        } else {
          let statusTakHadir = staffOnLeave[name] ? "CUTI - " + staffOnLeave[name] : "TIDAK HADIR";
          finalList.push({ nama: name, status: statusTakHadir, masaMasuk: "-", masaKeluar: "-", coordsIn: "", coordsOut: "", alamatIn: "", alamatOut: "" });
        }
      });

      results.push({ dateRaw: targetDateRaw, date: dateStr, attendance: finalList, calendarEvents: calendarEvents });
    }

    return { status: "SUCCESS", results: results };
  } catch(e) {
    return { status: "ERROR", message: e.toString() };
  }
}

function getStaffAttendanceByDateRange(username, dateStart, dateEnd) {
    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRowLog = logSheet.getLastRow();
    
    if (lastRowLog <= 1) return [];

    const startRow = Math.max(2, lastRowLog - 1000 + 1); 
    const logData = logSheet.getRange(startRow, 1, (lastRowLog - startRow + 1), 10).getValues();
    
    let targetStart = new Date(dateStart); targetStart.setHours(0,0,0,0);
    let targetEnd = new Date(dateEnd); targetEnd.setHours(23,59,59,999);

    let filteredLogs = [];
    for (let i = logData.length - 1; i >= 0; i--) {
        if (logData[i][2] == username) {
            let rowDate = new Date(logData[i][0]);
            
            if (rowDate >= targetStart && rowDate <= targetEnd) {
                let dateStr = Utilities.formatDate(rowDate, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
                let inStr = Utilities.formatDate(rowDate, "Asia/Kuala_Lumpur", "HH:mm");
                let statusReal = logData[i][3]; 
                let masaKeluar = logData[i][9]; 
                let outStr = "--:--";
                
                if (masaKeluar instanceof Date) outStr = Utilities.formatDate(masaKeluar, "Asia/Kuala_Lumpur", "HH:mm");
                else if (masaKeluar && String(masaKeluar).includes(":")) outStr = String(masaKeluar).replace("OUT:", "").trim();
                
                filteredLogs.push({ date: dateStr, status: statusReal, in: inStr, out: outStr });
            }
        }
    }
    return filteredLogs;
}

function getLaporanKelewatan(staffName, month, year) {
  try {
    // GAS CacheService — shared across all admins
    var gasCache = CacheService.getScriptCache();
    var gasCacheKey = 'laporan_v2_' + month + '_' + year + '_' + (staffName || 'all');
    var cached = gasCache.get(gasCacheKey);
    if (cached) return JSON.parse(cached);

    // Ambil late-start dari Config
    const configData = CONFIG_SHEET.getDataRange().getValues();
    let lateStart = "08:00";
    for (let i = 0; i < configData.length; i++) {
      if (String(configData[i][0]).trim().toUpperCase() === "LATE-START") {
        let lv = configData[i][1];
        lateStart = lv instanceof Date ? Utilities.formatDate(lv, "GMT+8", "HH:mm") : String(lv).trim().substring(0, 5);
        break;
      }
    }
    let [lh, lm] = lateStart.split(':').map(Number);
    let lateMinutes = lh * 60 + lm;

    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRow = logSheet.getLastRow();
    if (lastRow <= 1) return { status: 'SUCCESS', records: [], summary: { totalLewat: 0, totalMinit: 0, avgMinit: 0, lateStart: lateStart } };

    // Build set of visible staff (paparTracker != NO)
    const masterDataLL = SS.getSheetByName("Master_Staff").getDataRange().getValues();
    let visibleStaff = new Set();
    for (let i = 1; i < masterDataLL.length; i++) {
      let n = String(masterDataLL[i][1]).trim();
      let pt = masterDataLL[i][13] ? String(masterDataLL[i][13]).trim().toUpperCase() : "YES";
      if (n && pt !== "NO") visibleStaff.add(n);
    }

    const data = logSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    let records = [];

    for (let i = 0; i < data.length; i++) {
      if (!data[i][0]) continue;
      let nama = String(data[i][2]).trim();
      if (staffName && nama !== staffName) continue;
      if (!visibleStaff.has(nama)) continue; // exclude paparTracker=NO

      let d = new Date(data[i][0]);
      if (isNaN(d.getTime())) continue;
      if (d.getMonth() + 1 !== parseInt(month) || d.getFullYear() !== parseInt(year)) continue;

      let status = String(data[i][3] || "").toUpperCase();
      if (!status.includes("LEWAT")) continue;

      let masuk = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "HH:mm");
      let [mh, mm] = masuk.split(':').map(Number);
      let masukMinutes = mh * 60 + mm;
      let minitLewat = Math.max(0, masukMinutes - lateMinutes);
      let dateStr = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");

      records.push({ nama: nama, tarikh: dateStr, masuk: masuk, minitLewat: minitLewat });
    }

    records.sort(function(a, b) { return a.tarikh < b.tarikh ? -1 : 1; });

    let totalMinit = records.reduce(function(s, r) { return s + r.minitLewat; }, 0);
    let summary = {
      totalLewat: records.length,
      totalMinit: totalMinit,
      avgMinit: records.length > 0 ? Math.round(totalMinit / records.length) : 0,
      lateStart: lateStart
    };

    var result = { status: 'SUCCESS', records: records, summary: summary };
    try { gasCache.put(gasCacheKey, JSON.stringify(result), 900); } catch(e) {}
    return result;
  } catch(e) {
    return { status: 'ERROR', message: e.toString() };
  }
}

function getAllLeaveLog() {
  const sheet = SS.getSheetByName("Log_Cuti_Lewat");
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  let leaveLog = [];

  for (let i = 0; i < data.length; i++) {
    let jenis = String(data[i][2]);
    if (jenis.toLowerCase().includes("lambat")) continue;

    let timestamp = data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm") : data[i][0];
    let rawTarikhCuti = data[i][3];
    let tarikhCutiStr = rawTarikhCuti instanceof Date ? Utilities.formatDate(rawTarikhCuti, "Asia/Kuala_Lumpur", "dd/MM/yyyy") : rawTarikhCuti;
    let sortValue = rawTarikhCuti instanceof Date ? rawTarikhCuti.getTime() : 0;
    
    leaveLog.push({
      rowIndex: i + 2,
      timestamp: timestamp,
      nama: data[i][1],
      jenis: jenis,
      tarikhCuti: tarikhCutiStr,
      sebab: data[i][4],
      status: data[i][6] || "PROSES",
      lampiran: data[i][9] || "",
      sebabTolak: data[i][10] || "",
      sortTime: sortValue
    });
  }
  
  leaveLog.sort((a, b) => b.sortTime - a.sortTime);

  return leaveLog;
}

function changeLeaveType(rowIndex, newLeaveType, staffName) {
  try {
    const sheet = SS.getSheetByName("Log_Cuti_Lewat");
    if (!sheet) return { status: "ERROR", message: "Sheet Log_Cuti_Lewat tidak wujud." };

    const row = sheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
    const currentStatus = String(row[6] || "");

    if (currentStatus === "DITOLAK") {
      return { status: "ERROR", message: "Cuti yang ditolak tidak boleh ditukar jenis." };
    }

    sheet.getRange(rowIndex, 3).setValue(newLeaveType);

    var updatedBalance = getLeaveBalance(staffName);
    return {
      status: "SUCCESS",
      message: "Jenis cuti berjaya ditukar kepada " + newLeaveType,
      updatedBalance: updatedBalance.status === "SUCCESS" ? updatedBalance.data : null
    };
  } catch(e) {
    return { status: "ERROR", message: e.toString() };
  }
}

// ==========================================
// StaffManager.gs - (Pengurusan Pekerja)
// ==========================================

function getStaffList() {
  const masterSheet = SS.getSheetByName("Master_Staff");
  const masterData = masterSheet.getDataRange().getValues();
  let staffList = [];
  
  // Mulai dari i=1 untuk melewati baris header
  for (let i = 1; i < masterData.length; i++) {
    let nama = masterData[i][1];
    let statusPekerja = masterData[i][5] ? String(masterData[i][5]).trim().toUpperCase() : "";
    
    // Hanya masukkan ke dropdown portal jika statusnya "AKTIF"
    if (nama && String(nama).trim() !== "" && statusPekerja === "AKTIF") { 
      staffList.push(nama);
    }
  }
  return staffList;
}

function getStaffManagementData() {
  try {
    const ms = SS.getSheetByName("Master_Staff").getDataRange().getValues();
    const us = SS.getSheetByName("Users").getDataRange().getValues();
    let staffList = [];

    for (let i = 1; i < ms.length; i++) {
      let nama = ms[i][1];
      if (!nama || String(nama).trim() === "") continue; 

      staffList.push({
        rowIndex: i + 1,
        id: ms[i][0] || "-",
        nama: nama,
        jawatan: ms[i][2] || "",
        username: ms[i][4] || "",
        status: ms[i][5] ? String(ms[i][5]).charAt(0).toUpperCase() + String(ms[i][5]).slice(1).toLowerCase() : "Aktif",
        password: (us[i] && us[i][1]) ? us[i][1] : "",
        alLimit: parseInt(ms[i][6])  || 0,
        mcLimit: parseInt(ms[i][7])  || 0,
        hlLimit: parseInt(ms[i][8])  || 0,
        mlLimit: parseInt(ms[i][9])  || 0,
        plLimit: parseInt(ms[i][10]) || 0,
        elLimit: parseInt(ms[i][11]) || 0,
        blLimit: parseInt(ms[i][12]) || 0,
        paparTracker: ms[i][13] ? String(ms[i][13]).trim().toUpperCase() !== "NO" : true
      });
    }
    return { status: 'SUCCESS', data: staffList };
  } catch(e) {
    return { status: 'ERROR', message: "Ralat Pelayan: " + e.toString() };
  }
}

function saveStaffData(payload) {
  try {
    const ms = SS.getSheetByName("Master_Staff");
    const us = SS.getSheetByName("Users");

    if (payload.rowIndex) {
       // KEMASKINI STAF SEDIA ADA
       let r = payload.rowIndex;
       ms.getRange(r, 2).setValue(payload.nama);
       ms.getRange(r, 3).setValue(payload.jawatan);
       ms.getRange(r, 5).setValue(payload.username);
       ms.getRange(r, 6).setValue(payload.status);
       ms.getRange(r, 7).setValue(parseInt(payload.alLimit) || 0);
       ms.getRange(r, 8).setValue(parseInt(payload.mcLimit) || 0);
       ms.getRange(r, 9).setValue(parseInt(payload.hlLimit) || 0);
       ms.getRange(r, 10).setValue(parseInt(payload.mlLimit) || 0);
       ms.getRange(r, 11).setValue(parseInt(payload.plLimit) || 0);
       ms.getRange(r, 12).setValue(parseInt(payload.elLimit) || 0);
       ms.getRange(r, 13).setValue(parseInt(payload.blLimit) || 0);
       ms.getRange(r, 14).setValue(payload.paparTracker === false ? "NO" : "YES");
       us.getRange(r, 2).setValue(payload.password);
    } else {
       // TAMBAH STAF BARU (Cari baris kosong di Kolum B)
       let msData = ms.getRange("B1:B").getValues();
       let emptyRow = -1;
       for(let i=1; i<msData.length; i++) {
         if(String(msData[i][0]).trim() === "") {
           emptyRow = i + 1;
           break;
         }
       }
       if (emptyRow === -1) emptyRow = msData.length + 1;

       ms.getRange(emptyRow, 2).setValue(payload.nama);
       ms.getRange(emptyRow, 3).setValue(payload.jawatan);
       ms.getRange(emptyRow, 5).setValue(payload.username);
       ms.getRange(emptyRow, 6).setValue(payload.status);
       ms.getRange(emptyRow, 7).setValue(parseInt(payload.alLimit) || 0);
       ms.getRange(emptyRow, 8).setValue(parseInt(payload.mcLimit) || 0);
       ms.getRange(emptyRow, 9).setValue(parseInt(payload.hlLimit) || 0);
       ms.getRange(emptyRow, 10).setValue(parseInt(payload.mlLimit) || 0);
       ms.getRange(emptyRow, 11).setValue(parseInt(payload.plLimit) || 0);
       ms.getRange(emptyRow, 12).setValue(parseInt(payload.elLimit) || 0);
       ms.getRange(emptyRow, 13).setValue(parseInt(payload.blLimit) || 0);
       ms.getRange(emptyRow, 14).setValue(payload.paparTracker === false ? "NO" : "YES");
       us.getRange(emptyRow, 2).setValue(payload.password);
    }
    return { status: "SUCCESS", message: "Data staf berjaya disimpan!" };
  } catch (err) {
    return { status: "ERROR", message: "Gagal simpan: " + err.toString() };
  }
}

// ==========================================
// Config.gs - (Tetapan Sistem & QR)
// ==========================================

  // Baca semua tetapan sistem dari sheet Config
  // Dipanggil oleh DashboardAdmin apabila tab Tetapan dibuka
function getSystemConfig() {
  try {
    const configData = CONFIG_SHEET.getDataRange().getValues();
    let conf = {
      startQr: "",
      endQr: "",
      lateStart: "",
      linkFolder: "",
      adminUser: "",
      adminPass: "",
      officeLat: "",
      officeLng: "",
      officeRadius: 0,
      wfhDays: [],
      wfhDates: [],
      workDays: [],
      publicHolidays: []
    };

    let seenKeys = {};
    for (let i = 0; i < configData.length; i++) {
      let key = String(configData[i][0]).trim().toLowerCase();
      if (!key || seenKeys[key]) continue; // skip blank rows and duplicate keys
      seenKeys[key] = true;
      let val = configData[i][1];

      if (key === "start-qr") {
        conf.startQr = val instanceof Date
          ? Utilities.formatDate(val, "GMT+8", "HH:mm")
          : String(val).trim().substring(0, 5);
      }
      if (key === "end-qr") {
        conf.endQr = val instanceof Date
          ? Utilities.formatDate(val, "GMT+8", "HH:mm")
          : String(val).trim().substring(0, 5);
      }
      if (key === "late-start") {
        conf.lateStart = val instanceof Date
          ? Utilities.formatDate(val, "GMT+8", "HH:mm")
          : String(val).trim().substring(0, 5);
      }
      if (key === "link-folder")    conf.linkFolder    = String(val).trim();
      if (key === "admin_user")     conf.adminUser     = String(val).trim();
      if (key === "admin_pass")     conf.adminPass     = String(val).trim();
      if (key === "office_lat")     conf.officeLat     = val ? String(val).trim() : "";
      if (key === "office_lng")     conf.officeLng     = val ? String(val).trim() : "";
      if (key === "office_radius")  conf.officeRadius  = parseInt(val) || 0;

      if (key === "wfh_days") {
        let raw = String(val).trim();
        conf.wfhDays = raw !== "" ? raw.split(",").map(d => d.trim()) : [];
      }
      if (key === "wfh_dates") {
        let raw = val instanceof Date
          ? Utilities.formatDate(val, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
          : String(val).trim();
        conf.wfhDates = raw !== "" ? raw.split(",").map(d => d.trim()).filter(d => d !== "") : [];
      }
      if (key === "work_days") {
        let raw = String(val).trim();
        conf.workDays = raw !== "" ? raw.split(",").map(d => d.trim()).filter(d => d !== "") : [];
      }
      if (key === "public_holidays") {
        let raw = String(val).trim();
        if (raw !== "") {
          conf.publicHolidays = raw.split(",").map(entry => {
            let parts = entry.trim().split(":");
            return { date: parts[0] ? parts[0].trim() : "", name: parts.slice(1).join(":").trim() };
          }).filter(h => h.date !== "");
        }
      }
      if (key === "warning_trigger") { conf.warningTriggerLewat = String(val).toUpperCase().includes("LEWAT"); conf.warningTriggerTidakHadir = String(val).toUpperCase().includes("TIDAK_HADIR"); }
      if (key === "warning_threshold") conf.warningThreshold = parseInt(String(val)) || 3;
      if (key === "warning_auto_pdf") conf.warningAutoPdf = String(val).toUpperCase() === "TRUE";
      if (key === "warning_template_url") conf.warningTemplateUrl = String(val).trim();
    }

    return { status: "SUCCESS", data: conf };
  } catch (e) {
    return { status: "ERROR", message: "Gagal baca config: " + e.toString() };
  }
}

 // Simpan semua tetapan sistem ke sheet Config
 // Dipanggil apabila admin tekan "Simpan Semua Perubahan" 
function saveSystemConfig(payload) {
  try {
    // Guna lock supaya elak race condition
    const lock = LockService.getScriptLock();
    lock.tryLock(10000);

    // Tulis nilai satu per satu mengikut cell yang ditetapkan
    // B4 = start-qr
    CONFIG_SHEET.getRange("B4").setValue(payload.startQr);

    // B5 = end-qr
    CONFIG_SHEET.getRange("B5").setValue(payload.endQr);

    // B7 = link-folder
    CONFIG_SHEET.getRange("B7").setValue(payload.linkFolder);

    // B8 = admin_user
    CONFIG_SHEET.getRange("B8").setValue(payload.adminUser);

    // B9 = admin_pass (hanya kemaskini jika ada nilai baru, elak kosongkan)
    if (payload.adminPass && payload.adminPass.trim() !== "") {
      CONFIG_SHEET.getRange("B9").setValue(payload.adminPass);
    }

    // B13 = OFFICE_LAT
    CONFIG_SHEET.getRange("B13").setValue(payload.officeLat !== "" ? parseFloat(payload.officeLat) : "");

    // B14 = OFFICE_LNG
    CONFIG_SHEET.getRange("B14").setValue(payload.officeLng !== "" ? parseFloat(payload.officeLng) : "");

    // B15 = OFFICE_RADIUS
    CONFIG_SHEET.getRange("B15").setValue(parseInt(payload.officeRadius) || 0);

    // B16 = wfh_days — pastikan row 16 ada key "wfh_days"
    // Semak dulu sama ada row 16 wujud dengan key betul
    _ensureConfigRow("wfh_days", 16);
    CONFIG_SHEET.getRange("B16").setValue(
      Array.isArray(payload.wfhDays) ? payload.wfhDays.join(",") : ""
    );

    // B17 = wfh_dates — simpan sebagai TEKS supaya GAS tak auto-convert ke Date object
    _ensureConfigRow("wfh_dates", 17);
    {
      let wfhDatesCell = CONFIG_SHEET.getRange("B17");
      wfhDatesCell.setNumberFormat("@");
      wfhDatesCell.setValue(Array.isArray(payload.wfhDates) ? payload.wfhDates.join(",") : "");
    }

    // late-start — simpan sebagai TEKS supaya elak GAS menukar ke Date serial
    // (GAS setValue pada cell masa menggunakan LMT sejarah epoch 1899, menyebabkan +1h offset)
    {
      const lsAll = CONFIG_SHEET.getDataRange().getValues();
      let lsFound = false;
      for (let ki = 0; ki < lsAll.length; ki++) {
        if (String(lsAll[ki][0]).trim().toLowerCase() === "late-start") {
          let lsCell = CONFIG_SHEET.getRange(ki + 1, 2);
          lsCell.setNumberFormat("@");
          lsCell.setValue(payload.lateStart || "");
          lsFound = true;
          break;
        }
      }
      if (!lsFound) {
        let lr = CONFIG_SHEET.getLastRow() + 1;
        CONFIG_SHEET.getRange(lr, 1).setValue("late-start");
        let lsCell = CONFIG_SHEET.getRange(lr, 2);
        lsCell.setNumberFormat("@");
        lsCell.setValue(payload.lateStart || "");
      }
    }

    // work_days — hari bekerja (e.g. "Isnin,Selasa,Rabu,Khamis,Jumaat")
    _saveConfigByKey("work_days", Array.isArray(payload.workDays) ? payload.workDays.join(",") : "");

    // public_holidays — cuti umum dalam format "YYYY-MM-DD:Nama,..."
    if (Array.isArray(payload.publicHolidays)) {
      let phStr = payload.publicHolidays.map(h => h.date + ":" + h.name).join(",");
      _saveConfigByKey("public_holidays", phStr);
    }

    lock.releaseLock();

    return { status: "SUCCESS", message: "Tetapan sistem berjaya disimpan!" };
  } catch (e) {
    return { status: "ERROR", message: "Gagal simpan tetapan: " + e.toString() };
  }
}

function _saveConfigByKey(key, value) {
  try {
    const data = CONFIG_SHEET.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === key.toLowerCase()) {
        CONFIG_SHEET.getRange(i + 1, 2).setValue(value);
        return;
      }
    }
    let r = CONFIG_SHEET.getLastRow() + 1;
    CONFIG_SHEET.getRange(r, 1).setValue(key);
    CONFIG_SHEET.getRange(r, 2).setValue(value);
  } catch(e) {}
}


 // Helper: Pastikan row tertentu ada key yang betul di kolum A
 // Jika kosong, tulis key tersebut
function _ensureConfigRow(keyName, rowNum) {
  try {
    let existingKey = String(CONFIG_SHEET.getRange(rowNum, 1).getValue()).trim().toLowerCase();
    if (existingKey === "" || existingKey !== keyName.toLowerCase()) {
      CONFIG_SHEET.getRange(rowNum, 1).setValue(keyName);
    }
  } catch(e) {
    // Abaikan jika row tak wujud, spreadsheet akan create sendiri
  }
}

//   Semak sama ada hari ini adalah hari WFH
//  (berdasarkan wfh_days dan wfh_dates dalam Config)
//   Fungsi ini boleh digunakan oleh processScan jika perlu
function isWfhToday() {
  try {
    const configData = CONFIG_SHEET.getDataRange().getValues();
    let wfhDays = [];
    let wfhDates = [];

    for (let i = 0; i < configData.length; i++) {
      let key = String(configData[i][0]).trim().toLowerCase();
      let rawVal = configData[i][1];
      let val = rawVal instanceof Date
        ? Utilities.formatDate(rawVal, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(rawVal).trim();
      if (key === "wfh_days" && val !== "") {
        wfhDays = val.split(",").map(d => d.trim().toLowerCase());
      }
      if (key === "wfh_dates" && val !== "") {
        wfhDates = val.split(",").map(d => d.trim());
      }
    }

    const today = new Date();
    const dayNames = ["ahad","isnin","selasa","rabu","khamis","jumaat","sabtu"];
    const todayName = dayNames[today.getDay()];
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "yyyy-MM-dd");

    // Semak hari tetap
    if (wfhDays.includes(todayName)) return true;

    // Semak tarikh override
    if (wfhDates.includes(todayStr)) return true;

    return false;
  } catch(e) {
    return false;
  }
}

// ==========================================
// Outstation.gs - (Pengecualian Outstation)
// ==========================================

function isOutstationToday(nama) {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return false;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < data.length; i++) {
      let staffNama = String(data[i][1]).trim();
      let tarikhRaw = data[i][2];
      let tarikhStr = tarikhRaw instanceof Date
        ? Utilities.formatDate(tarikhRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(tarikhRaw).trim();
      if (staffNama === nama && tarikhStr === todayStr) return true;
    }
    return false;
  } catch (e) { return false; }
}

function _parseMasaStr(raw) {
  if (!raw) return "08:00";
  if (raw instanceof Date) return Utilities.formatDate(raw, "Asia/Kuala_Lumpur", "HH:mm");
  let s = String(raw).trim();
  return s.length >= 5 ? s.substring(0, 5) : "08:00";
}

function getOutstationList() {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return { status: 'SUCCESS', data: [] };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: 'SUCCESS', data: [] };
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    let list = [];
    for (let i = 0; i < data.length; i++) {
      if (!data[i][1] || String(data[i][1]).trim() === "") continue;
      let tarikhRaw = data[i][2];
      let tarikhStr = tarikhRaw instanceof Date
        ? Utilities.formatDate(tarikhRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(tarikhRaw).trim();
      let tsStr = data[i][0] instanceof Date
        ? Utilities.formatDate(data[i][0], "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm")
        : String(data[i][0]);
      list.push({
        rowIndex: i + 2,
        timestamp: tsStr,
        nama: String(data[i][1]).trim(),
        tarikh: tarikhStr,
        autoClockIn: String(data[i][3]).toUpperCase() === "TRUE",
        masaClockIn: _parseMasaStr(data[i][4]),
        sebab: data[i][5] ? String(data[i][5]) : "",
        status: data[i][6] ? String(data[i][6]) : "PENDING"
      });
    }
    return { status: 'SUCCESS', data: list };
  } catch (e) { return { status: 'ERROR', message: e.toString() }; }
}

function saveOutstation(payload) {
  try {
    let sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) {
      sheet = SS.insertSheet("Log_Outstation");
      sheet.appendRow(["Timestamp", "Nama_Staf", "Tarikh_Outstation", "Auto_ClockIn", "Masa_ClockIn", "Sebab", "Status"]);
    }
    let tarikhDate = new Date(payload.tarikh);
    if (payload.rowIndex) {
      let r = payload.rowIndex;
      sheet.getRange(r, 2).setValue(payload.nama);
      sheet.getRange(r, 3).setValue(tarikhDate);
      sheet.getRange(r, 4).setValue(payload.autoClockIn ? "TRUE" : "FALSE");
      sheet.getRange(r, 5).setValue(payload.masaClockIn || "08:00");
      sheet.getRange(r, 6).setValue(payload.sebab || "");
    } else {
      sheet.appendRow([new Date(), payload.nama, tarikhDate, payload.autoClockIn ? "TRUE" : "FALSE", payload.masaClockIn || "08:00", payload.sebab || "", "PENDING"]);
    }
    return { status: 'SUCCESS', message: 'Rekod outstation berjaya disimpan!' };
  } catch (e) { return { status: 'ERROR', message: e.toString() }; }
}

function saveOutstationBatch(payload) {
  try {
    let sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) {
      sheet = SS.insertSheet("Log_Outstation");
      sheet.appendRow(["Timestamp", "Nama_Staf", "Tarikh_Outstation", "Auto_ClockIn", "Masa_ClockIn", "Sebab", "Status"]);
    }
    // Jana semua tarikh dalam julat
    let dates = [];
    let cur = new Date(payload.tarikhDari + 'T00:00:00');
    let end = new Date(payload.tarikhHingga + 'T00:00:00');
    while (cur <= end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    let now = new Date();
    let count = 0;
    payload.staffNames.forEach(function(nama) {
      dates.forEach(function(d) {
        sheet.appendRow([now, nama, d, payload.autoClockIn ? "TRUE" : "FALSE", payload.masaClockIn || "08:00", payload.sebab || "", "PENDING"]);
        count++;
      });
    });
    return { status: 'SUCCESS', message: count + ' rekod outstation berjaya disimpan!' };
  } catch(e) { return { status: 'ERROR', message: e.toString() }; }
}

function deleteOutstation(rowIndex) {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return { status: 'ERROR', message: 'Sheet tidak wujud.' };
    sheet.deleteRow(rowIndex);
    return { status: 'SUCCESS' };
  } catch (e) { return { status: 'ERROR', message: e.toString() }; }
}

function _applyOutstationClockIn(sheet, rowNum, nama, masaStr, sebab, today, logData) {
  let alreadyIn = false;
  for (let j = 1; j < logData.length; j++) {
    let rowDate = new Date(logData[j][0]);
    if (String(logData[j][2]) === nama &&
        rowDate.getDate() === today.getDate() &&
        rowDate.getMonth() === today.getMonth() &&
        rowDate.getFullYear() === today.getFullYear()) {
      alreadyIn = true; break;
    }
  }
  sheet.getRange(rowNum, 7).setValue("DONE");
  if (!alreadyIn) {
    let clockInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let masParts = masaStr.split(":");
    if (masParts.length >= 2) {
      let h = parseInt(masParts[0]);
      let m = parseInt(masParts[1]);
      if (!isNaN(h) && !isNaN(m)) clockInTime.setHours(h, m, 0, 0);
    }
    LOG_SHEET.appendRow([
      clockInTime, "OUTSTATION-AUTO", nama, "CLOCK-IN",
      "", "Outstation. Sebab: " + sebab, "", "Auto-System", "Outstation"
    ]);
    return true;
  }
  return false;
}

// Dipanggil manual dari Admin Dashboard (proses semua pending hari ini tanpa semak masa)
function processOutstationAutoClockIn() {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return { status: 'SUCCESS', processed: 0, names: [] };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { status: 'SUCCESS', processed: 0, names: [] };
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const logData = LOG_SHEET.getDataRange().getValues();
    let processed = 0;
    let names = [];
    for (let i = 0; i < data.length; i++) {
      if (!data[i][1] || String(data[i][1]).trim() === "") continue;
      let tarikhRaw = data[i][2];
      let tarikhStr = tarikhRaw instanceof Date
        ? Utilities.formatDate(tarikhRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(tarikhRaw).trim();
      let autoClockIn = String(data[i][3]).toUpperCase() === "TRUE";
      let status = String(data[i][6] || "PENDING");
      if (tarikhStr !== todayStr || !autoClockIn || status === "DONE") continue;
      let nama = String(data[i][1]).trim();
      let masaStr = _parseMasaStr(data[i][4]);
      let sebab = data[i][5] ? String(data[i][5]) : "Outstation";
      let didClockIn = _applyOutstationClockIn(sheet, i + 2, nama, masaStr, sebab, today, logData);
      if (didClockIn) { processed++; names.push(nama); }
    }
    return { status: 'SUCCESS', processed: processed, names: names };
  } catch (e) { return { status: 'ERROR', message: e.toString() }; }
}

// Dipanggil sekali sehari oleh daily trigger
// Proses semua rekod outstation hari ini, clock-in ikut masa yang dikonfigure tiap rekod
function processOutstationTrigger() {
  try {
    const sheet = SS.getSheetByName("Log_Outstation");
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const logData = LOG_SHEET.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
      if (!data[i][1] || String(data[i][1]).trim() === "") continue;
      let tarikhRaw = data[i][2];
      let tarikhStr = tarikhRaw instanceof Date
        ? Utilities.formatDate(tarikhRaw, "Asia/Kuala_Lumpur", "yyyy-MM-dd")
        : String(tarikhRaw).trim();
      let autoClockIn = String(data[i][3]).toUpperCase() === "TRUE";
      let status = String(data[i][6] || "PENDING");
      if (tarikhStr !== todayStr || !autoClockIn || status === "DONE") continue;
      let nama = String(data[i][1]).trim();
      let masaStr = _parseMasaStr(data[i][4]);
      let sebab = data[i][5] ? String(data[i][5]) : "Outstation";
      _applyOutstationClockIn(sheet, i + 2, nama, masaStr, sebab, today, logData);
    }
  } catch (e) { console.log("processOutstationTrigger error: " + e); }
}

// Dipanggil dari web admin — SIMPAN MASA KE CONFIG SAHAJA, tak create trigger
function saveOutstationTriggerTime_web(triggerTime) {
  try {
    let timeStr = triggerTime ? String(triggerTime).trim().substring(0, 5) : "09:00";
    _saveOutstationTriggerTime(timeStr);
    return { status: 'SUCCESS', message: 'Masa trigger disimpan: ' + timeStr + '. Pergi WAZZA MENU → Setup Auto Trigger untuk apply.' };
  } catch(e) {
    return { status: 'ERROR', message: e.toString() };
  }
}

// Core function — create trigger (version-tied jika dipanggil dari web app)
function setupOutstationTrigger(triggerTime) {
  try {
    let timeStr = triggerTime ? String(triggerTime).trim().substring(0, 5) : "09:00";
    let hour = 9, minute = 0;
    if (timeStr.includes(":")) {
      let parts = timeStr.split(":");
      hour = parseInt(parts[0]) || 9;
      minute = parseInt(parts[1]) || 0;
    }

    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'processOutstationTrigger') ScriptApp.deleteTrigger(triggers[i]);
    }
    ScriptApp.newTrigger('processOutstationTrigger')
      .timeBased().everyDays(1).atHour(hour).nearMinute(minute).create();

    _saveOutstationTriggerTime(timeStr);

    let jam = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    return { status: 'SUCCESS', message: 'Auto Trigger ditetapkan pada jam ' + jam + ' setiap hari secara automatik.' };
  } catch (e) {
    return { status: 'ERROR', message: e.toString() };
  }
}

// Wrapper untuk GAS menu — auto-baca masa dari Config, create HEAD trigger
function setupOutstationTriggerFromMenu() {
  const ui = SpreadsheetApp.getUi();
  let configTime = "09:00";
  try {
    let r = getOutstationTriggerTime();
    if (r.time && r.time.length === 5) configTime = r.time;
  } catch(e) {}

  let res = ui.alert(
    '⚙️ Setup Auto Trigger Outstation',
    'Trigger akan ditetapkan pada jam ' + configTime + ' (dari Tetapan Sistem).\n\nTeruskan?',
    ui.ButtonSet.YES_NO
  );
  if (res === ui.Button.YES) {
    let result = setupOutstationTrigger(configTime);
    ui.alert(result.status === 'SUCCESS' ? '✅ ' + result.message : '❌ ' + result.message);
  }
}

function _saveOutstationTriggerTime(timeStr) {
  try {
    const configData = CONFIG_SHEET.getDataRange().getValues();
    for (let i = 0; i < configData.length; i++) {
      if (String(configData[i][0]).trim().toLowerCase() === "outstation_trigger") {
        CONFIG_SHEET.getRange(i + 1, 2).setValue(timeStr);
        return;
      }
    }
    let newRow = CONFIG_SHEET.getLastRow() + 1;
    CONFIG_SHEET.getRange(newRow, 1).setValue("outstation_trigger");
    CONFIG_SHEET.getRange(newRow, 2).setValue(timeStr);
  } catch(e) {}
}

function getOutstationTriggerTime() {
  try {
    const configData = CONFIG_SHEET.getDataRange().getValues();
    for (let i = 0; i < configData.length; i++) {
      if (String(configData[i][0]).trim().toLowerCase() === "outstation_trigger") {
        return { status: 'SUCCESS', time: _parseMasaStr(configData[i][1]) || "09:00" };
      }
    }
    return { status: 'SUCCESS', time: "09:00" };
  } catch(e) {
    return { status: 'SUCCESS', time: "09:00" };
  }
}

function getDailyToken() {
  var token = CONFIG_SHEET.getRange("B2").getValue();
  if (token == "") {
    token = generateNewToken();
  }
  return token;
}

function generateNewToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let randomString = '';
  
  for (let i = 0; i < 8; i++) {
    randomString += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const newToken = randomString.substring(0, 4) + "-" + randomString.substring(4, 8);
  
  CONFIG_SHEET.getRange("B2").setValue(newToken); 
  CONFIG_SHEET.getRange("B3").setValue(new Date()); 
  
  console.log("Token Baru Dijana: " + newToken);
  return newToken;
}

function getDashboardStatus() {
  const configData = CONFIG_SHEET.getRange("B2:B5").getValues();
  let token = configData[0][0];
  let startTime = configData[2][0];
  let endTime = configData[3][0];

  if (token == "") token = generateNewToken();

  let isOpen = true;
  let message = "";
  const now = new Date();
  const nowStr = Utilities.formatDate(now, "GMT+8", "HH:mm");

  if (startTime && endTime) {
    if (nowStr >= startTime && nowStr <= endTime) {
      isOpen = true;
    } else {
      isOpen = false;
      message = (nowStr < startTime) ? "SESI BELUM MULA" : "TAMAT";
    }
  }

  let lateStart = "";
  const allConfig = CONFIG_SHEET.getDataRange().getValues();
  for (let i = 0; i < allConfig.length; i++) {
    if (String(allConfig[i][0]).trim().toUpperCase() === "LATE-START") {
      let lv = allConfig[i][1];
      lateStart = lv instanceof Date ? Utilities.formatDate(lv, "GMT+8", "HH:mm") : String(lv).trim().substring(0, 5);
      break; // first match wins — ignore any duplicate rows
    }
  }

  const isLate = isOpen && lateStart.length === 5 && nowStr > lateStart;
  return { token: token, isOpen: isOpen, statusMsg: message, isLate: isLate, lateStart: lateStart };
}

// ==========================================
// SISTEM SURAT AMARAN
// ==========================================

function getWarningSettings() {
  try {
    const data = CONFIG_SHEET.getDataRange().getValues();
    let s = { triggerLewat: true, triggerTidakHadir: false, threshold: 3, cooldown: "1", autoPdf: false, templateUrl: "" };
    for (let i = 0; i < data.length; i++) {
      let key = String(data[i][0]).trim().toLowerCase();
      let val = String(data[i][1]).trim();
      if (key === "warning_trigger") { s.triggerLewat = val.toUpperCase().includes("LEWAT"); s.triggerTidakHadir = val.toUpperCase().includes("TIDAK_HADIR"); }
      if (key === "warning_threshold") s.threshold = parseInt(val) || 3;
      if (key === "warning_cooldown") s.cooldown = val || "1";
      if (key === "warning_auto_pdf") s.autoPdf = val.toUpperCase() === "TRUE";
      if (key === "warning_template_url") s.templateUrl = val;
    }
    return { status: "SUCCESS", data: s };
  } catch(e) { return { status: "ERROR", message: e.toString() }; }
}

function saveWarningSettings(payload) {
  try {
    let trigger = [];
    if (payload.triggerLewat) trigger.push("LEWAT");
    if (payload.triggerTidakHadir) trigger.push("TIDAK_HADIR");
    _saveConfigByKey("warning_trigger", trigger.join(","));
    _saveConfigByKey("warning_threshold", String(payload.threshold || 3));
    _saveConfigByKey("warning_cooldown", String(payload.cooldown || "1"));
    _saveConfigByKey("warning_auto_pdf", payload.autoPdf ? "TRUE" : "FALSE");
    _saveConfigByKey("warning_template_url", payload.templateUrl || "");
    return { status: "SUCCESS", message: "Tetapan surat amaran disimpan." };
  } catch(e) { return { status: "ERROR", message: e.toString() }; }
}

function _extractDocId(url) {
  let match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getWarningReport(month, year) {
  try {
    // GAS CacheService — shared across all admins, TTL 15 minit
    var gasCache = CacheService.getScriptCache();
    var gasCacheKey = 'warning_v3_' + month + '_' + year;
    var cached = gasCache.get(gasCacheKey);
    if (cached) return JSON.parse(cached);

    const configData = CONFIG_SHEET.getDataRange().getValues();
    let triggerLewat = true, triggerTidakHadir = false, threshold = 3;
    let workDays = [], publicHolidays = new Set();
    for (let i = 0; i < configData.length; i++) {
      let key = String(configData[i][0]).trim().toLowerCase();
      let valStr = String(configData[i][1]).trim();
      if (key === "warning_trigger") { triggerLewat = valStr.toUpperCase().includes("LEWAT"); triggerTidakHadir = valStr.toUpperCase().includes("TIDAK_HADIR"); }
      if (key === "warning_threshold") threshold = parseInt(valStr) || 3;
      if (key === "work_days") workDays = valStr.split(",").map(d => d.trim().toLowerCase()).filter(d => d);
      if (key === "public_holidays" && valStr) valStr.split(",").forEach(function(e) { let d = e.split(":")[0].trim(); if (d) publicHolidays.add(d); });
    }

    // Fixed: calendar month, tapi cap pada hari ini kalau bulan semasa
    let startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    let monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    let today = new Date(); today.setHours(23, 59, 59, 0);
    let endDate = monthEnd < today ? monthEnd : today;

    const masterData = SS.getSheetByName("Master_Staff").getDataRange().getValues();
    let activeStaff = [];
    for (let i = 1; i < masterData.length; i++) {
      let nama = String(masterData[i][1]).trim();
      let status = String(masterData[i][5] || "").trim().toUpperCase();
      let paparTracker = masterData[i][13] ? String(masterData[i][13]).trim().toUpperCase() : "YES";
      if (nama && status === "AKTIF" && paparTracker !== "NO") activeStaff.push({ nama: nama, jawatan: String(masterData[i][2] || "") });
    }

    const logSheet = SS.getSheetByName("Log_Kehadiran");
    const lastRow = logSheet.getLastRow();
    let logData = lastRow > 1 ? logSheet.getRange(2, 1, lastRow - 1, 10).getValues() : [];

    let violations = {}, presentDates = {};
    activeStaff.forEach(function(s) { violations[s.nama] = { lewat: [], tidakHadir: [] }; presentDates[s.nama] = new Set(); });

    for (let i = 0; i < logData.length; i++) {
      if (!logData[i][0]) continue;
      let d = new Date(logData[i][0]);
      if (d < startDate || d > endDate) continue; // filter dalam cooldown window
      let nama = String(logData[i][2]).trim();
      let st = String(logData[i][3] || "").toUpperCase();
      if (!violations[nama]) continue;
      let ds = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
      presentDates[nama].add(ds);
      if (triggerLewat && st.includes("LEWAT")) violations[nama].lewat.push(ds);
    }

    if (triggerTidakHadir && workDays.length > 0) {
      // Baca tarikh cuti yang DILULUSKAN dari Log_Cuti_Lewat — exclude dari Tidak Hadir
      let approvedLeaveDates = {}; // { nama: Set of dd/MM/yyyy }
      try {
        const cutiSheet = SS.getSheetByName("Log_Cuti_Lewat");
        if (cutiSheet && cutiSheet.getLastRow() > 1) {
          const cutiData = cutiSheet.getRange(2, 1, cutiSheet.getLastRow() - 1, 7).getValues();
          for (let i = 0; i < cutiData.length; i++) {
            let nama = String(cutiData[i][1]).trim();
            let status = String(cutiData[i][6] || "").trim().toUpperCase();
            if (status !== "DILULUSKAN") continue;
            let tarikhCuti = cutiData[i][3];
            if (!tarikhCuti) continue;
            let d = new Date(tarikhCuti);
            if (isNaN(d.getTime())) continue;
            if (d < startDate || d > endDate) continue;
            let ds = Utilities.formatDate(d, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
            if (!approvedLeaveDates[nama]) approvedLeaveDates[nama] = new Set();
            approvedLeaveDates[nama].add(ds);
          }
        }
      } catch(e) {}

      const DAY_NAMES = ["ahad","isnin","selasa","rabu","khamis","jumaat","sabtu"];
      let cur = new Date(startDate);
      let end = new Date(endDate); end.setHours(0,0,0,0);
      while (cur <= end) {
        let dayName = DAY_NAMES[cur.getDay()];
        if (workDays.includes(dayName)) {
          let ds = Utilities.formatDate(cur, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
          let dr = Utilities.formatDate(cur, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
          if (!publicHolidays.has(dr)) {
            activeStaff.forEach(function(s) {
              let hadir = presentDates[s.nama].has(ds);
              let onLeave = approvedLeaveDates[s.nama] && approvedLeaveDates[s.nama].has(ds);
              if (!hadir && !onLeave) violations[s.nama].tidakHadir.push(ds);
            });
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    let suratLog = {};
    try {
      let ls = SS.getSheetByName("Log_Surat_Amaran");
      if (ls && ls.getLastRow() > 1) {
        let ld = ls.getRange(2, 1, ls.getLastRow() - 1, 6).getValues();
        ld.forEach(function(r) {
          if (parseInt(r[2]) === parseInt(month) && parseInt(r[3]) === parseInt(year)) {
            if (!suratLog[r[1]]) suratLog[r[1]] = { hasSurat: false, isReset: false, suratUrl: "" };
            if (r[4] === "SURAT") { suratLog[r[1]].hasSurat = true; suratLog[r[1]].suratUrl = r[5] || ""; }
            if (r[4] === "RESET") suratLog[r[1]].isReset = true;
          }
        });
      }
    } catch(e) {}

    let report = activeStaff.map(function(s) {
      let v = violations[s.nama];
      let sl = suratLog[s.nama] || { hasSurat: false, isReset: false, suratUrl: "" };
      let total = v.lewat.length + v.tidakHadir.length;
      return { nama: s.nama, jawatan: s.jawatan, lewat: v.lewat.length, lewatDates: v.lewat.join(", "), tidakHadir: v.tidakHadir.length, tidakHadirDates: v.tidakHadir.join(", "), total: total, isLayak: !sl.isReset && total >= threshold, hasSurat: sl.hasSurat, suratUrl: sl.suratUrl, isReset: sl.isReset };
    }).filter(function(s) { return s.total > 0; });

    var result = { status: "SUCCESS", data: report, threshold: threshold };
    try { gasCache.put(gasCacheKey, JSON.stringify(result), 900); } catch(e) {}
    return result;
  } catch(e) { return { status: "ERROR", message: e.toString() }; }
}

function generateSuratAmaran(staffName, month, year) {
  try {
    const MONTHS_MY = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
    const monthName = MONTHS_MY[parseInt(month) - 1];
    const masterData = SS.getSheetByName("Master_Staff").getDataRange().getValues();
    let jawatan = "Staff", staffId = "-";
    for (let i = 1; i < masterData.length; i++) {
      if (String(masterData[i][1]).trim() === staffName) { jawatan = masterData[i][2] || "Staff"; staffId = masterData[i][0] || "-"; break; }
    }
    const rpt = getWarningReport(month, year);
    let staffData = rpt.data ? rpt.data.find(function(s) { return s.nama === staffName; }) : null;
    let violationLines = [];
    let violationText = "";
    if (staffData) {
      if (staffData.lewat > 0) violationLines.push("• Kelewatan: " + staffData.lewat + " kali (" + staffData.lewatDates + ")");
      if (staffData.tidakHadir > 0) violationLines.push("• Tidak Hadir: " + staffData.tidakHadir + " kali (" + staffData.tidakHadirDates + ")");
    }
    violationText = violationLines.join("\n");
    const today = new Date();
    const todayStr = Utilities.formatDate(today, "Asia/Kuala_Lumpur", "dd MMMM yyyy");
    const suratNo = "SA/" + year + "/" + String(month).padStart(2,"0") + "/" + String(staffId).replace(/\s/g,"");
    const pdfName = "Surat Amaran - " + staffName + " - " + monthName + " " + year + ".pdf";

    // Cuba guna template Google Doc jika ada
    let templateUrl = "";
    try {
      const cd = CONFIG_SHEET.getDataRange().getValues();
      for (let i = 0; i < cd.length; i++) {
        if (String(cd[i][0]).trim().toLowerCase() === "warning_template_url") { templateUrl = String(cd[i][1]).trim(); break; }
      }
    } catch(e) {}

    let docToExport;
    const templateId = _extractDocId(templateUrl);

    // ── Buat / copy dokumen ──
    let docFile;
    if (templateId) {
      // Guna Google Doc template — copy & replace placeholders
      docFile = DriveApp.getFileById(templateId).makeCopy(pdfName.replace(".pdf",""));
      const copyDoc = DocumentApp.openById(docFile.getId());
      const body = copyDoc.getBody();
      body.replaceText("\\{\\{SURAT_NO\\}\\}", suratNo);
      body.replaceText("\\{\\{TARIKH\\}\\}", todayStr);
      body.replaceText("\\{\\{NAMA_STAFF\\}\\}", staffName);
      body.replaceText("\\{\\{JAWATAN\\}\\}", jawatan);
      body.replaceText("\\{\\{BULAN_TAHUN\\}\\}", monthName + " " + year);
      body.replaceText("\\{\\{VIOLATIONS\\}\\}", violationText || "-");
      copyDoc.saveAndClose();
    } else {
      // Fallback — generate hardcoded
      const doc = DocumentApp.create(pdfName.replace(".pdf",""));
      const body = doc.getBody();
      body.setMarginTop(50).setMarginBottom(50).setMarginLeft(70).setMarginRight(70);
      const BOLD = DocumentApp.Attribute.BOLD;
      const FS = DocumentApp.Attribute.FONT_SIZE;
      body.appendParagraph("SURAT AMARAN KEHADIRAN").setAlignment(DocumentApp.HorizontalAlignment.CENTER).setAttributes({[BOLD]:true,[FS]:14});
      body.appendParagraph("No. Rujukan: " + suratNo).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Tarikh: " + todayStr).setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Kepada:").setAttributes({[FS]:11});
      body.appendParagraph(staffName).setAttributes({[BOLD]:true,[FS]:11});
      body.appendParagraph(jawatan).setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("PERKARA: SURAT AMARAN KEHADIRAN BAGI BULAN " + monthName.toUpperCase() + " " + year).setAttributes({[BOLD]:true,[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Merujuk perkara di atas, pihak pengurusan ingin memaklumkan bahawa rekod kehadiran anda bagi bulan " + monthName + " " + year + " menunjukkan perkara berikut:").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      violationLines.forEach(function(line) { body.appendParagraph(line).setAttributes({[FS]:11}); });
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Anda diingatkan bahawa ketidakhadiran atau kelewatan yang berulang boleh menjejaskan prestasi kerja dan mengakibatkan tindakan tatatertib lanjut diambil.").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Sila berjumpa dengan pihak pengurusan dalam masa 3 hari bekerja dari tarikh surat ini untuk penjelasan lanjut.").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Sekian, terima kasih.").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Yang benar,").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("____________________________").setAttributes({[FS]:11});
      body.appendParagraph("Tandatangan Pengurusan").setAttributes({[FS]:11});
      body.appendParagraph("Tarikh: _________________").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("―".repeat(40)).setAttributes({[FS]:10});
      body.appendParagraph("Pengesahan Penerimaan Surat").setAttributes({[BOLD]:true,[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Saya mengakui telah menerima dan memahami kandungan surat ini.").setAttributes({[FS]:11});
      body.appendParagraph("").setAttributes({[FS]:11});
      body.appendParagraph("Nama: " + staffName).setAttributes({[FS]:11});
      body.appendParagraph("Tandatangan: ____________________________").setAttributes({[FS]:11});
      body.appendParagraph("Tarikh: _________________").setAttributes({[FS]:11});
      doc.saveAndClose();
      docFile = DriveApp.getFileById(doc.getId());
    }

    // ── Export PDF (sama untuk kedua-dua path) ──
    const pdfBlob = docFile.getAs(MimeType.PDF);
    pdfBlob.setName(pdfName);
    let folder = DriveApp.getRootFolder();
    try {
      const cd = CONFIG_SHEET.getDataRange().getValues();
      for (let i = 0; i < cd.length; i++) {
        if (String(cd[i][0]).trim().toLowerCase() === "link-folder") {
          let match = String(cd[i][1]).trim().match(/[-\w]{25,}/);
          if (match) { folder = DriveApp.getFolderById(match[0]); break; }
        }
      }
    } catch(e) {}
    const pdfFile = folder.createFile(pdfBlob);
    docFile.setTrashed(true);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    let ls = SS.getSheetByName("Log_Surat_Amaran");
    if (!ls) { ls = SS.insertSheet("Log_Surat_Amaran"); ls.appendRow(["Timestamp","Nama_Staff","Bulan","Tahun","Jenis","URL"]); }
    ls.appendRow([new Date(), staffName, parseInt(month), parseInt(year), "SURAT", pdfFile.getUrl()]);
    return { status: "SUCCESS", url: pdfFile.getUrl(), message: "Surat amaran berjaya dijana." };
  } catch(e) { return { status: "ERROR", message: e.toString() }; }
}

function resetStaffWarning(staffName, month, year) {
  try {
    let ls = SS.getSheetByName("Log_Surat_Amaran");
    if (!ls) { ls = SS.insertSheet("Log_Surat_Amaran"); ls.appendRow(["Timestamp","Nama_Staff","Bulan","Tahun","Jenis","URL"]); }
    ls.appendRow([new Date(), staffName, parseInt(month), parseInt(year), "RESET", ""]);
    return { status: "SUCCESS", message: "Rekod amaran " + staffName + " telah direset." };
  } catch(e) { return { status: "ERROR", message: e.toString() }; }
}
