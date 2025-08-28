// Simple client-side backup utilities.
// 1) Incremental appointment change log (existing logic)
// 2) Full database snapshot (appointments + customers) kept up-to-date via listeners
// NOTE: This is NOT a substitute for server/off-site backups.

import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// --- Incremental appointment change log ---
const STORAGE_KEY = 'appointmentBackupsV1';
const MAX_ENTRIES = 1000; // cap to avoid unbounded growth

// --- Full DB snapshot (single latest) ---
const FULL_DB_KEY = 'fullDatabaseBackupV1';
// Optional history of snapshots (capped)
const FULL_DB_HISTORY_KEY = 'fullDatabaseBackupHistoryV1';
const FULL_DB_HISTORY_LIMIT = 30; // keep last 30 full snapshots (configurable)

let fullBackupUnsubscribers = [];
let latestAppointmentsMap = {}; // by date => [appointments]
let latestCustomersMap = {}; // by customer id => customer
let pendingFullPersist = null;

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    return JSON.parse(raw);
  } catch(e){
    console.warn('Backup load error', e); return [];
  }
}

function persist(list){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e){ console.warn('Backup persist error', e); }
}

export function backupAppointment(action, appointment){
  if(typeof window === 'undefined') return; // SSR safety
  if(!appointment) return;
  const list = loadAll();
  list.push({ ts: new Date().toISOString(), action, appointment });
  if(list.length > MAX_ENTRIES){ list.splice(0, list.length - MAX_ENTRIES); }
  persist(list);
}

export function getBackups(){ return loadAll(); }

export function downloadBackups(){
  const data = JSON.stringify(loadAll(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `appointment-backups-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ================= FULL DATABASE SNAPSHOT =================

function persistFullSnapshot(snapshot){
  try { localStorage.setItem(FULL_DB_KEY, JSON.stringify(snapshot)); } catch(e){ console.warn('Full DB persist error', e); }
  // history (best-effort)
  try {
    const raw = localStorage.getItem(FULL_DB_HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ ts: snapshot.updatedAt, size: JSON.stringify(snapshot).length });
    while(arr.length > FULL_DB_HISTORY_LIMIT) arr.shift();
    localStorage.setItem(FULL_DB_HISTORY_KEY, JSON.stringify(arr));
  } catch(e){ /* non-fatal */ }
}

function scheduleFullPersist(){
  if(pendingFullPersist) return;
  pendingFullPersist = setTimeout(()=>{
    pendingFullPersist = null;
    const snapshot = {
      updatedAt: new Date().toISOString(),
      appointments: latestAppointmentsMap,
      customers: latestCustomersMap,
      meta: {
        appointmentDates: Object.keys(latestAppointmentsMap).length,
        customersCount: Object.keys(latestCustomersMap).length,
        note: 'Full DB snapshot for recovery. Restore logic must re-upload to Firestore manually.'
      }
    };
    persistFullSnapshot(snapshot);
  }, 250); // debounce multiple rapid snapshot events
}

export function getFullDatabaseSnapshot(){
  try {
    const raw = localStorage.getItem(FULL_DB_KEY); if(!raw) return null; return JSON.parse(raw);
  } catch(e){ return null; }
}

export function startFullDatabaseAutoBackup(){
  if(typeof window === 'undefined') return () => {};
  stopFullDatabaseAutoBackup();
  // Listen appointments
  const unsubAppts = onSnapshot(collection(db, 'appointments'), snap => {
    const byDate = {};
    snap.forEach(d => {
      const a = d.data();
      if(!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });
    latestAppointmentsMap = byDate;
    scheduleFullPersist();
  }, err => console.warn('Full backup appointments snapshot error', err));

  // Listen customers
  const unsubCustomers = onSnapshot(collection(db, 'customers'), snap => {
    const byId = {};
    snap.forEach(d => { byId[d.id] = d.data(); });
    latestCustomersMap = byId;
    scheduleFullPersist();
  }, err => console.warn('Full backup customers snapshot error', err));

  fullBackupUnsubscribers = [unsubAppts, unsubCustomers];
  // If nightly auto-download preference is enabled, ensure scheduler is running
  try {
    const pref = localStorage.getItem('nightlyAutoDownloadEnabledV1');
    if (pref === 'true') {
      scheduleNightlyDownload();
    }
  } catch (e) { /* ignore */ }

  return stopFullDatabaseAutoBackup;
}

export function stopFullDatabaseAutoBackup(){
  fullBackupUnsubscribers.forEach(u => { try { u(); } catch(_){} });
  fullBackupUnsubscribers = [];
}

export function downloadFullDatabaseSnapshot(){
  const snapshot = getFullDatabaseSnapshot();
  if(!snapshot){ console.warn('No full DB snapshot to download'); return; }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `full-db-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ================= NIGHTLY AUTO-DOWNLOAD SCHEDULER =================
let nightlyTimer = null;
const NIGHTLY_PREF_KEY = 'nightlyAutoDownloadEnabledV1';
const LAST_NIGHTLY_KEY = 'lastNightlyDownloadV1';

function msUntilNext(hour = 23, minute = 0) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleNightlyDownload() {
  try { stopNightlyDownload(); } catch(_){}
  // schedule first run
  const ms = msUntilNext(23, 0);
  nightlyTimer = setTimeout(function run() {
    try {
      // ensure full snapshot persisted to localStorage before download
      const snap = getFullDatabaseSnapshot();
      if (!snap) {
        console.warn('Nightly download: no full snapshot available; skipping file download.');
      } else {
        downloadFullDatabaseSnapshot();
        try { localStorage.setItem(LAST_NIGHTLY_KEY, new Date().toISOString()); } catch(e){}
      }
    } catch (err) { console.error('Nightly download error', err); }
    // schedule next run in ~24h
    nightlyTimer = setTimeout(run, 24 * 60 * 60 * 1000);
  }, ms);
}

function stopNightlyDownload() {
  if (nightlyTimer) { clearTimeout(nightlyTimer); nightlyTimer = null; }
}

export function enableNightlyAutoDownload(enable = true) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(NIGHTLY_PREF_KEY, enable ? 'true' : 'false'); } catch(e){}
  if (enable) {
    scheduleNightlyDownload();
  } else {
    stopNightlyDownload();
  }
}

export function isNightlyAutoDownloadEnabled() {
  try { return localStorage.getItem(NIGHTLY_PREF_KEY) === 'true'; } catch(e){ return false; }
}

export function getLastNightlyDownloadTimestamp() {
  try { return localStorage.getItem(LAST_NIGHTLY_KEY); } catch(e){ return null; }
}

// (Optional) restore helpers can be added later; we intentionally avoid automatic write-back for safety.
