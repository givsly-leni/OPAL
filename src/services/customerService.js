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
  const data = {
    id: key,
    phoneKey: key,
    phone: customer.phone,
    name: customer.name || customer.client || '',
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
