import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth, firebaseProjectId } from '../firebase.js';
import dayjs from 'dayjs';

const COLLECTION_NAME = 'appointments';

// Toggle verbose appointment logs by setting REACT_APP_DEBUG_APPTS=true (CRA) or VITE_DEBUG_APPTS=true (Vite).
const DEBUG_APPTS = (() => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_DEBUG_APPTS === 'true') return true;
  } catch (e) {}
  try {
    if (import.meta && import.meta.env && (import.meta.env.VITE_DEBUG_APPTS === 'true' || import.meta.env.REACT_APP_DEBUG_APPTS === 'true')) return true;
  } catch (e) {}
  return false;
})();

// Save appointment to Firebase
export const saveAppointment = async (appointment) => {
  const MAX_ATTEMPTS = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const isUpdate = !!appointment.id;
      // Log a brief action summary (avoid printing full objects)
      if (DEBUG_APPTS) console.log(isUpdate ? `Updating appointment: id=${appointment.id}` : 'Creating new appointment');

      // Reuse provided id when updating; otherwise generate new one
      const appointmentId = isUpdate
        ? appointment.id
        : `${appointment.date}_${appointment.employee}_${appointment.time}_${Date.now()}`;

      const baseTimestamps = isUpdate
        ? { updatedAt: new Date().toISOString() }
        : { createdAt: new Date().toISOString() };

      const appointmentData = {
        ...appointment,
        id: appointmentId,
        ...baseTimestamps
      };

      if (DEBUG_APPTS) console.log(`Saving appointment id=${appointmentId} (update=${isUpdate}) attempt=${attempt}`);

      // If creating a new appointment (no id provided), ensure no existing appointment
      // occupies the same date/employee/time to avoid duplicates.
      if (!isUpdate) {
        try {
          const q = query(collection(db, COLLECTION_NAME), where('date', '==', appointment.date), where('employee', '==', appointment.employee), where('time', '==', appointment.time));
          const snap = await getDocs(q);
          if (!snap.empty) {
            // return conflict information to caller
            const existingId = snap.docs[0].id;
            const err = new Error('Slot conflict: existing appointment at same date/employee/time');
            err.code = 'SLOT_CONFLICT';
            err.existingId = existingId;
            throw err;
          }
        } catch (qerr) {
          // if it's our conflict error bubble it up, otherwise continue to attempt saving
          if (qerr && qerr.code === 'SLOT_CONFLICT') throw qerr;
          // otherwise, ignore and proceed — rare query failure will be caught by setDoc below and retried
        }
      }

      // merge so we don't accidentally wipe fields if we pass partial data
      await setDoc(doc(db, COLLECTION_NAME, appointmentId), appointmentData, { merge: true });
      if (DEBUG_APPTS) console.log(`Appointment saved: id=${appointmentData.id} date=${appointmentData.date} time=${appointmentData.time}`);
      return appointmentId;
    } catch (error) {
      lastErr = error;
      // small backoff for transient errors
      const isLast = attempt === MAX_ATTEMPTS;
      console.warn(`saveAppointment attempt ${attempt} failed:`, error?.code || error?.message || error);
      if (isLast) {
        console.error('Error saving appointment to Firebase after retries:', lastErr);
        throw lastErr;
      }
      // exponential backoff
      const delay = 150 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

// Get all appointments from Firebase
export const getAppointments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const appointments = {};
    
    querySnapshot.forEach((doc) => {
      const raw = doc.data();
      // normalize fields to stable shapes used by the UI, prefer stored id but fall back to Firestore doc id
      const appointment = {
        ...raw,
        id: raw.id || doc.id,
        date: raw.date ? String(raw.date) : undefined,
        time: raw.time ? String(raw.time) : undefined,
        paymentType: raw.paymentType || 'cash',
        price: (raw.price !== undefined && raw.price !== null && raw.price !== '') ? (isNaN(Number(raw.price)) ? raw.price : Number(raw.price)) : null
      };
      const dateKey = appointment.date;

      if (!appointments[dateKey]) {
        appointments[dateKey] = [];
      }
      appointments[dateKey].push(appointment);
    });
    
  // Avoid logging the full appointments object (can be very large and slow).
  const total = Object.keys(appointments).reduce((sum, k) => sum + (appointments[k]?.length || 0), 0);
    if (DEBUG_APPTS) console.log(`Loaded ${total} appointments from Firebase (summary only)`);
  return appointments;
  } catch (error) {
    console.error('Error getting appointments:', error);
    return {};
  }
};

// Delete appointment from Firebase
export const deleteAppointment = async (appointmentId) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, appointmentId));
  if (DEBUG_APPTS) console.log(`Appointment deleted: id=${appointmentId}`);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    throw error;
  }
};

// Purge appointments with date strictly less than the provided cutoff (YYYY-MM-DD).
// If no cutoff is provided, uses today's date and thus will delete all appointments
// from previous days but not today's appointments.
// Find appointments with date strictly less than the provided cutoff (YYYY-MM-DD)
export const findAppointmentsBefore = async (cutoffDateStr) => {
  const cutoff = cutoffDateStr && String(cutoffDateStr).trim()
    ? cutoffDateStr
    : dayjs().format('YYYY-MM-DD');
  const q = query(collection(db, COLLECTION_NAME), where('date', '<', cutoff));
  const snap = await getDocs(q);
  const docs = [];
  snap.forEach(d => {
    const raw = d.data();
    docs.push({ id: d.id, date: raw.date, time: raw.time, employee: raw.employee, client: raw.client });
  });
  return docs;
};

// Purge appointments with date strictly less than the provided cutoff (YYYY-MM-DD).
// If no cutoff is provided, uses today's date and thus will delete all appointments
// from previous days but not today's appointments. Pass `dryRun = true` to only
// list matching appointments without deleting them.
export const purgeAppointmentsBefore = async (cutoffDateStr, dryRun = false) => {
  const cutoff = cutoffDateStr && String(cutoffDateStr).trim()
    ? cutoffDateStr
    : dayjs().format('YYYY-MM-DD');
  try {
  if (DEBUG_APPTS) console.log(`Finding appointments with date < ${cutoff}`);
    const docs = await findAppointmentsBefore(cutoff);
    if (docs.length === 0) {
  if (DEBUG_APPTS) console.log(`No appointments found to purge before ${cutoff}`);
      return { deletedCount: 0, matched: [] };
    }

    if (dryRun) {
  if (DEBUG_APPTS) console.log('Dry run enabled — returning matched appointments without deleting');
      return { deletedCount: 0, matched: docs };
    }

    // Firestore limits batches to 500 operations; use a safe chunk size
    const CHUNK = 400;
    let deletedCount = 0;
    const ids = docs.map(d => d.id);
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + CHUNK);
      for (const id of chunk) {
        batch.delete(doc(db, COLLECTION_NAME, id));
      }
      await batch.commit();
      deletedCount += chunk.length;
    if (DEBUG_APPTS) console.log(`Committed batch deleting ${chunk.length} appointments`);
    }

  if (DEBUG_APPTS) console.log(`Purge complete. Deleted appointments: ${deletedCount}`);
    return { deletedCount, matched: docs };
  } catch (err) {
    console.error('Error purging appointments before', cutoff, err);
    throw err;
  }
};

// Listen to real-time updates
export const subscribeToAppointments = (callback) => {
  // Subscriptions can deliver large snapshots; log only brief summaries.
  if (DEBUG_APPTS) console.log('Starting Firebase real-time subscription (summary logs only)');
  
  const unsubscribe = onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
  if (DEBUG_APPTS) console.log(`Firebase snapshot received: ${snapshot.docChanges().length} change(s)`);
      const appointments = {};
      snapshot.forEach((doc) => {
        const raw = doc.data();
        const appointment = {
          ...raw,
          id: raw.id || doc.id,
          date: raw.date ? String(raw.date) : undefined,
          time: raw.time ? String(raw.time) : undefined,
          paymentType: raw.paymentType || 'cash',
          price: (raw.price !== undefined && raw.price !== null && raw.price !== '') ? (isNaN(Number(raw.price)) ? raw.price : Number(raw.price)) : null
        };
        const dateKey = appointment.date;
        if (!appointments[dateKey]) appointments[dateKey] = [];
        appointments[dateKey].push(appointment);
      });
      // Log only a small summary to avoid huge console output in the browser
      const totalDates = Object.keys(appointments).length;
      const totalAppts = Object.keys(appointments).reduce((sum, k) => sum + (appointments[k]?.length || 0), 0);
  if (DEBUG_APPTS) console.log(`Processed appointments: ${totalAppts} appointments across ${totalDates} date(s)`);
      callback(appointments);
  }, (error) => {
    try {
      const uid = auth?.currentUser?.uid;
      console.error('Firebase subscription error:', error, { uid, projectId: firebaseProjectId });
    } catch(_) {
      console.error('Firebase subscription error:', error);
    }
  });
  
  return unsubscribe;
};
