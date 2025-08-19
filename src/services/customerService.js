import { doc, setDoc, getDoc } from 'firebase/firestore';
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
    lastAppointmentAt: customer.lastAppointmentAt || now,
    updatedAt: now,
    createdAt: customer.createdAt || now,
  };
  await setDoc(doc(db, COLLECTION_NAME, key), data, { merge: true });
  return data;
}
