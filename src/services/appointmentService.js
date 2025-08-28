import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'appointments';

// Save appointment to Firebase
export const saveAppointment = async (appointment) => {
  try {
    const isUpdate = !!appointment.id;
    console.log(isUpdate ? 'Updating appointment in Firebase:' : 'Creating new appointment in Firebase:', appointment);

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

    console.log('Saving with ID:', appointmentId, 'Data:', appointmentData, 'isUpdate:', isUpdate);

    // merge so we don't accidentally wipe fields if we pass partial data
    await setDoc(doc(db, COLLECTION_NAME, appointmentId), appointmentData, { merge: true });
    console.log('Appointment successfully saved to Firebase:', appointmentData);
    return appointmentId;
  } catch (error) {
    console.error('Error saving appointment to Firebase:', error);
    console.error('Error details:', error.message, error.code);
    throw error;
  }
};

// Get all appointments from Firebase
export const getAppointments = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const appointments = {};
    
    querySnapshot.forEach((doc) => {
      const raw = doc.data();
      // normalize fields to stable shapes used by the UI
      const appointment = {
        ...raw,
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
    
    console.log('Appointments loaded from Firebase:', appointments);
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
    console.log('Appointment deleted from Firebase:', appointmentId);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    throw error;
  }
};

// Listen to real-time updates
export const subscribeToAppointments = (callback) => {
  console.log('Starting Firebase real-time subscription...');
  
  const unsubscribe = onSnapshot(collection(db, COLLECTION_NAME), (snapshot) => {
    console.log('Firebase snapshot received, changes:', snapshot.docChanges().length);
    const appointments = {};
    
    snapshot.forEach((doc) => {
      const raw = doc.data();
      const appointment = {
        ...raw,
        date: raw.date ? String(raw.date) : undefined,
        time: raw.time ? String(raw.time) : undefined,
        paymentType: raw.paymentType || 'cash',
        price: (raw.price !== undefined && raw.price !== null && raw.price !== '') ? (isNaN(Number(raw.price)) ? raw.price : Number(raw.price)) : null
      };
      const dateKey = appointment.date;
      
      console.log('Processing appointment:', appointment);
      
      if (!appointments[dateKey]) {
        appointments[dateKey] = [];
      }
      appointments[dateKey].push(appointment);
    });
    
    console.log('Processed appointments for callback:', appointments);
    callback(appointments);
  }, (error) => {
    console.error('Firebase subscription error:', error);
  });
  
  return unsubscribe;
};
