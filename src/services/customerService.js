import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'customers';

// Normalize phone to a stable key (digits only) so different spacings / formats map to same record
export function phoneToKey(rawPhone = '') {
  return rawPhone.replace(/[^0-9]/g, '');
}

export async function getCustomerByPhone(phone) {
  const key = phoneToKey(phone);
  if (!key) return null;
  try {
    const ref = doc(db, COLLECTION_NAME, key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error('Error fetching customer by phone', phone, err);
    return null;
  }
}

export async function saveCustomer(customer) {
  const key = phoneToKey(customer.phone);
  if (!key) throw new Error('Invalid phone for customer');
  const now = new Date().toISOString();
  const nameRaw = customer.name || customer.client || '';
  const nameLower = nameRaw.toLowerCase();
  const nameSearch = nameLower.normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const data = {
    id: key,
    phoneKey: key,
    phone: customer.phone,
    name: nameRaw,
    nameLower,
    nameSearch,
    notes: customer.notes || customer.description || '',
  clientInfo: customer.clientInfo || customer.info || '',
    lastAppointmentAt: customer.lastAppointmentAt || now,
    updatedAt: now,
    createdAt: customer.createdAt || now,
  };
  await setDoc(doc(db, COLLECTION_NAME, key), data, { merge: true });
  return data;
}

// Search customers by phone prefix (simple starts-with) limited results
export async function searchCustomersByPhonePrefix(prefix, max = 5) {
  const normalized = phoneToKey(prefix);
  if (!normalized) return [];
  try {
    // Firestore doesn't have direct 'startsWith' so we create a range query
    // For numeric-only keys we can use >= prefix and < prefix + next unicode char
    const start = normalized;
    // Append '\uf8ff' (high code point) to capture all starting with the prefix
    const end = normalized + '\uf8ff';
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('phoneKey', '>=', start), where('phoneKey', '<=', end), orderBy('phoneKey'), limit(max));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push(d.data()));
    return results;
  } catch (err) {
    console.error('Error searching customers by phone prefix', prefix, err);
    return [];
  }
}

// Search customers by name prefix (case-insensitive). We store name as provided; for prefix search we create a range.
export async function searchCustomersByNamePrefix(prefix, max = 5) {
  const term = (prefix || '').trim().toLowerCase();
  if(!term) return [];
  try {
    const start = term;
    const end = term + '\uf8ff';
    const colRef = collection(db, COLLECTION_NAME);
    // Prefer accent-insensitive search using nameSearch field (stored accentless lowercase)
    let qRef = query(colRef, where('nameSearch','>=',start), where('nameSearch','<=',end), orderBy('nameSearch'), limit(max));
    let snap;
    try {
      snap = await getDocs(qRef);
    } catch(indexErr){
      // Fallback: fetch first N ordered by nameLower and filter client-side (less efficient but acceptable for small dataset)
      const fb = query(colRef, orderBy('nameLower'), limit(80));
      const fbSnap = await getDocs(fb);
      const arr = [];
      fbSnap.forEach(d=> arr.push(d.data()));
      const norm = (s='')=>s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
      return arr.filter(c => norm(c.name||'').startsWith(norm(term))).slice(0,max);
    }
    const results = [];
    snap.forEach(d=> results.push(d.data()));
    return results;
  } catch(err){
    console.error('Error searching customers by name prefix', prefix, err);
    return [];
  }
}
