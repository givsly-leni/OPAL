import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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

// Initialize Auth
export const auth = getAuth(app);

// Ensure an authenticated session (anonymous)
export async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user || null;
  } catch (e) {
    console.warn('Anonymous sign-in failed', e);
    return null;
  }
}

// Expose the Firebase project id used by this build for diagnostics
export const firebaseProjectId = app?.options?.projectId || undefined;
