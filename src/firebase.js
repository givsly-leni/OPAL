import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// You'll need to replace this with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBFZolf-0gLhFyFia13IzaeEkegTPe9Q_8",
  authDomain: "opal-appointment.firebaseapp.com",
  projectId: "opal-appointment",
  storageBucket: "opal-appointment.firebasestorage.app",
  messagingSenderId: "581688119794",
  appId: "1:581688119794:web:18b296f1c8c63ea988db6b",
  measurementId: "G-G64KF1BHXN"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
