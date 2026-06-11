// ==========================================================================
// olin-app.js — kit bersama untuk semua page (callGAS, session, toast, util)
// SATU tempat untuk set URL GAS. Semua HTML page load fail ni.
// ==========================================================================

// ====== CONFIG ======
// Tampal URL Web App selepas Deploy > New deployment > Web app.
const GAS_URL = "https://script.google.com/macros/s/AKfycbzj-f7vaKdv1YsAYem8mZ1cIN0lhxlOg9Hj_gYSYYpYVAgb_osgou1EaKHSpZk1W0c_5A/exec";
// ====================

// Panggil GAS. action = nama action; params = objek; callback success/error.
// GET untuk baca; POST text/plain untuk tulis (elak CORS preflight).
const WRITE_ACTIONS = ["addSale", "addPurchase", "addExpense", "login"];
function callGAS(action, params, onSuccess, onError) {
  var body = Object.assign({ action: action }, params || {});
  if (WRITE_ACTIONS.indexOf(action) !== -1) {
    fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){ if(onSuccess) onSuccess(d); })
    .catch(function(err){ if(onError) onError(err); else console.error("callGAS", action, err); });
    return;
  }
  var url = GAS_URL + "?data=" + encodeURIComponent(JSON.stringify(body));
  fetch(url)
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(function(d){ if(onSuccess) onSuccess(d); })
    .catch(function(err){ if(onError) onError(err); else console.error("callGAS", action, err); });
}

// ====== SESSION (passcode disimpan local; auth sebenar di server) ======
function isLoggedIn(){ return !!localStorage.getItem("olin_pass"); }
function setSession(pc, nama){ localStorage.setItem("olin_pass", pc); localStorage.setItem("olin_nama", nama||"Kedai Olin"); }
function logout(){ localStorage.removeItem("olin_pass"); localStorage.removeItem("olin_nama"); location.href="portal.html"; }
// Panggil di awal setiap page dalaman — halau ke login kalau belum masuk.
function requireLogin(){ if(!isLoggedIn()){ location.href="portal.html"; return false; } return true; }

// ====== UI HELPERS ======
function toast(msg, type){
  var t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.className = "toast show " + (type||"");
  clearTimeout(window._toastT);
  window._toastT = setTimeout(function(){ t.className = "toast"; }, 3000);
}
function rm(n){ // format RM
  var v = (parseFloat(n)||0).toFixed(2);
  return "RM " + v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function todayISO(){
  var d = new Date(), tz = d.getTimezoneOffset()*60000;
  return new Date(d - tz).toISOString().slice(0,10);
}
