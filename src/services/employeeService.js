import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'employees';

export async function getEmployees() {
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  return snap.docs.map(d => d.data());
}

export async function saveEmployee(employee) {
  // Convert schedule ranges to strings to avoid nested arrays
  let employeeToSave = { ...employee };
  if (employeeToSave.schedule) {
    const newSchedule = {};
    Object.entries(employeeToSave.schedule).forEach(([day, ranges]) => {
      if (Array.isArray(ranges)) {
        newSchedule[day] = ranges.map(r => Array.isArray(r) ? `${r[0]}:00-${r[1]}:00` : r);
      } else {
        newSchedule[day] = ranges;
      }
    });
    employeeToSave.schedule = newSchedule;
  }
  const ref = doc(db, COLLECTION_NAME, employee.id);
  await setDoc(ref, employeeToSave, { merge: true });
}

export async function deleteEmployee(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
