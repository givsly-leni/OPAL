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
    console.log('Attempting to save appointment to Firebase:', appointment);
    const appointmentId = `${appointment.date}_${appointment.employee}_${appointment.time}_${Date.now()}`;
    const appointmentData = {
      ...appointment,
      id: appointmentId,
      createdAt: new Date().toISOString()
    };
    
    console.log('Saving with ID:', appointmentId, 'Data:', appointmentData);
    
    await setDoc(doc(db, COLLECTION_NAME, appointmentId), appointmentData);
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
      const appointment = doc.data();
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
      const appointment = doc.data();
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
