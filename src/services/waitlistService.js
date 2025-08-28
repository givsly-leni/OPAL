import { collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { searchCustomersByNamePrefix, searchCustomersByPhonePrefix, saveCustomer } from './customerService';

// Keep a lightweight localStorage fallback for offline or dev scenarios
const STORAGE_KEY = 'opal_waitlist_v1';

function readStore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ console.warn('waitlist read error', e); return {}; }
}

function writeStore(obj){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch(e){ console.warn('waitlist write error', e); }
}

function makeLocalId(){
  return 'w_' + Math.random().toString(36).slice(2,9);
}

const COLLECTION_NAME = 'waitlist';

// Load waitlist entries for a date from Firestore. Falls back to localStorage if network fails.
export async function loadWaitlistForDate(dateStr){
  try{
    const colRef = collection(db, COLLECTION_NAME);
    // avoid requiring composite Firestore index by querying only by equality and sorting client-side
    const q = query(colRef, where('date', '==', dateStr));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    // sort by createdAt if present
    results.sort((a,b)=> (a.createdAt || '') > (b.createdAt || '') ? 1 : -1);
    return results;
  }catch(err){
    // fallback
    const store = readStore();
    return store[dateStr] ? store[dateStr].slice().sort((a,b)=> (a.createdAt > b.createdAt ? 1 : -1)) : [];
  }
}

// Add waiting entry. Also try to upsert customer record for quick retrieval later.
export async function addWaiting(dateStr, entry){
  const payload = {
    date: dateStr,
    name: entry.name || '',
    phone: entry.phone || '',
    prefs: entry.prefs || '',
    createdAt: new Date().toISOString(),
  };
  try{
    const colRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(colRef, payload);
    // Try to save customer record (non-blocking)
    if(payload.phone){
      try{ await saveCustomer({ phone: payload.phone, name: payload.name }); }catch(e){ /* ignore */ }
    }
    return { id: docRef.id, ...payload };
  }catch(err){
    // fallback to localstore
    const store = readStore();
    const list = store[dateStr] || [];
    const e = { id: makeLocalId(), ...payload };
    store[dateStr] = [...list, e];
    writeStore(store);
    return e;
  }
}

export async function removeWaiting(dateStr, id){
  try{
    // Attempt to delete Firestore doc by id
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  }catch(err){
    // fallback: remove from localstore
    try{
      const store = readStore();
      const list = store[dateStr] || [];
      store[dateStr] = list.filter(x=>x.id !== id);
      writeStore(store);
      return true;
    }catch(e){
      console.warn('Failed to remove waiting', err, e);
      return false;
    }
  }
}

// Get a single waitlist entry by Firestore document id (or local fallback)
export async function getWaitingById(id){
  try{
    const ref = doc(db, COLLECTION_NAME, id);
    const snap = await getDoc(ref);
    if(snap.exists()) return { id: snap.id, ...snap.data() };
    // not found in Firestore, fall back to local store search
  }catch(err){ /* fall through to local */ }
  const store = readStore();
  // search through all dates
  for(const d of Object.keys(store)){
    const found = (store[d]||[]).find(x=>x.id === id);
    if(found) return found;
  }
  return null;
}

// Update an existing waitlist entry (Firestore or local fallback)
export async function updateWaiting(id, updates){
  try{
    const ref = doc(db, COLLECTION_NAME, id);
    await setDoc(ref, updates, { merge: true });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() };
  }catch(err){
    // fallback: update in local store if present
    try{
      const store = readStore();
      let written = false;
      for(const d of Object.keys(store)){
        const list = store[d] || [];
        const idx = list.findIndex(x=>x.id === id);
        if(idx !== -1){
          store[d][idx] = { ...store[d][idx], ...updates };
          written = true;
          break;
        }
      }
      if(written){ writeStore(store); return { id, ...updates }; }
    }catch(e){ /* ignore */ }
    return null;
  }
}

// Helpers to provide suggestion lists in the form
export async function suggestCustomersByName(prefix, max=6){
  try{ return await searchCustomersByNamePrefix(prefix, max); }catch(e){ return []; }
}

export async function suggestCustomersByPhone(prefix, max=6){
  try{ return await searchCustomersByPhonePrefix(prefix, max); }catch(e){ return []; }
}

export function clearAll(){ writeStore({}); }

export default { loadWaitlistForDate, addWaiting, removeWaiting, clearAll, suggestCustomersByName, suggestCustomersByPhone };
