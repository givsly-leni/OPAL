import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Paper, 
  Stack, 
  Title, 
  Text, 
  Button, 
  TextInput, 
  Select, 
  NumberInput, 
  Textarea, 
  Group, 
  Container,
  Divider
} from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { saveAppointment, deleteAppointment, getAppointments as fetchAppointments } from '../services/appointmentService';
import { getCustomerByPhone, saveCustomer, searchCustomersByPhonePrefix, searchCustomersByNamePrefix } from '../services/customerService';
import { backupAppointment } from '../services/backupService';
import dayjs from 'dayjs';
import { getEmployeeScheduleForDate } from '../services/scheduleService';

// Local debug flag for appointment logs (set REACT_APP_DEBUG_APPTS or VITE_DEBUG_APPTS)
const DEBUG_APPTS = (() => {
  try { if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_DEBUG_APPTS === 'true') return true; } catch(e){}
  try { if (import.meta && import.meta.env && (import.meta.env.VITE_DEBUG_APPTS === 'true' || import.meta.env.REACT_APP_DEBUG_APPTS === 'true')) return true; } catch(e){}
  return false;
})();

const EMPLOYEES = [
  { id: 'aggelikh', name: 'Αγγελικη' },
  { id: 'emmanouela', name: 'Εμμανουελα' },
  { id: 'hliana', name: 'Ηλιανα' },
  { id: 'kelly', name: 'Κέλλυ' },
];

// Per-employee working hours (weekday -> array of [start,end]) matching ScheduleGrid
const EMPLOYEE_SCHEDULE = {
  aggelikh: {
    2: [['10:00','16:00'], ['19:00','21:00']],
    3: [['13:00','21:00']],
    4: [['10:00','16:00'], ['19:00','21:00']],
    5: [['13:00','21:00']],
  },
  emmanouela: {
    2: [['13:00','21:00']],
    3: [['13:00','21:00']],
    4: [['13:00','21:00']],
    5: [['09:00','17:00']],
    6: [['09:00','15:00']],
  },
  hliana: {
    2: [['13:00','21:00']],
    3: [['10:00','18:00']],
    4: [['13:00','21:00']],
    5: [['13:00','21:00']],
    6: [['09:00','15:00']],
  }
  ,
  kelly: {
    3: [['17:00','21:00']],
    4: [['17:00','21:00']],
    5: [['17:00','21:00']],
    6: [['10:00','15:00']],
  }
};

const BUSINESS_HOURS = {
  0: null,
  1: null,
  2: { start: 10, end: 21 },
  3: { start: 10, end: 21 },
  4: { start: 10, end: 21 },
  5: { start: 9, end: 21 },
  6: { start: 9, end: 15 },
};

function generateHoursForDate(date) {
  const dayNum = dayjs(date).day();
  const config = BUSINESS_HOURS[dayNum];
  if (!config) return [];
  const { start, end } = config;
  const hours = [];
  for (let h = start; h <= end; h++) {
    hours.push(dayjs().hour(h).minute(0).format('HH:00'));
  }
  return hours;
}

// Compute available start times (HH:mm) for an employee on a date given a required duration (minutes)
function computeAvailableSlots({ date, assigned, duration, appointments = {}, excludeId = null, slotMinutes = 15 }) {
  if (!assigned) return [];
  const dayNum = dayjs(date).day();
  const ranges = getEmployeeScheduleForDate(assigned, date) || [];
  if (!ranges.length) return [];

  const dateKey = dayjs(date).format('YYYY-MM-DD');
  const empAppts = (appointments[dateKey] || []).filter(a => a.employee === assigned && a.id !== excludeId)
    .map(a => {
      const start = dayjs(`${dateKey}T${a.time}`);
      const dur = parseInt(a.duration || 30, 10) || 30;
      return { start, end: start.add(dur, 'minute') };
    });

  const slots = [];
  // duration === 0 is allowed and treated as the minimal slot size (slotMinutes)
  const raw = parseInt(duration, 10) || 0;
  const req = raw === 0 ? slotMinutes : raw;

  function overlaps(s1, e1, s2, e2) {
    return s1.isBefore(e2) && s2.isBefore(e1);
  }

  for (const [rs, re] of ranges) {
    let cursor = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${rs}`);
    const rangeEnd = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${re}`);
    const lastStart = rangeEnd.subtract(req, 'minute');
  while (cursor.isBefore(lastStart) || cursor.isSame(lastStart)) {
      const candidateEnd = cursor.add(req, 'minute');
      // check overlap with existing appointments
      let bad = false;
      for (const ap of empAppts) {
        if (overlaps(cursor, candidateEnd, ap.start, ap.end)) { bad = true; break; }
      }
      if (!bad) {
        slots.push(cursor.format('HH:mm'));
      }
      cursor = cursor.add(slotMinutes, 'minute');
    }
  }

  // dedupe and sort
  return Array.from(new Set(slots)).sort();
}

export function AppointmentForm({ appointments, setAppointments }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const dateStr = searchParams.get('date');
  const employeeId = searchParams.get('employee');
  const hour = searchParams.get('hour');
  const mode = searchParams.get('mode') || 'new';
  const paramId = searchParams.get('id');
  
  const date = dateStr ? new Date(dateStr) : new Date();
  const hours = generateHoursForDate(date);
  
  const [form, setForm] = useState({
    id: undefined, // existing appointment id when editing
    client: '',
    phone: '',
    description: '',
    clientInfo: '', // persistent client information (preferences, notes)
    price: '',
    paymentType: 'cash',
  durationSelect: '30',
  // Appointment assigned employee (which column the appointment belongs to)
  assignedEmployee: employeeId || '',
  // Do NOT default the preference to the column employee; keep the placeholder
  employeeSelect: '',
  employeeExplicit: false,
  // selected time (HH:mm)
  time: hour || '',
    
  });
  const [formError, setFormError] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);


  // Prefer the actual assigned employee from the loaded form when available
  const employee = EMPLOYEES.find(e => e.id === (form?.assignedEmployee || employeeId));

  const [availableSlots, setAvailableSlots] = useState([]);
  const originalApptRef = useRef(null);

  // Calculate remaining free minutes from selected hour until either next appointment or shift end
  useEffect(()=>{
    const assigned = form.assignedEmployee;
    if(!assigned) { return; }

    // effectiveSelTime falls back to the route hour or the original appointment's time when editing
    const effectiveSelTime = form.time || hour || (mode === 'edit' && originalApptRef.current && originalApptRef.current.employee === assigned ? originalApptRef.current.time : '');

    // duration needed for checks
    const needed = parseInt(form.duration || 0, 10);

    // If we have no selected/effective time, we still want to clear the error when there
    // exist available slots for the requested duration (e.g., user corrected duration to a fitting one).
    if(!effectiveSelTime) {
      if (needed > 0) {
        if (!Array.isArray(availableSlots) || availableSlots.length === 0) {
          setScheduleError('Δεν υπάρχουν διαθέσιμες ώρες για αυτή τη διάρκεια');
          return;
        }
        // there are available slots for this duration -> clear the error so user can proceed
        setScheduleError('');
        return;
      }
      // no time and no needed duration -> keep prior message (if any)
      return;
    }

    const dayNum = dayjs(date).day();
    const ranges = getEmployeeScheduleForDate(assigned, date) || [];
    // Find containing working range
    const targetRange = ranges.find(([rs,re]) => effectiveSelTime >= rs && effectiveSelTime < re);
    if(!targetRange){ setScheduleError('Εκτός ωραρίου εργαζόμενου'); return; }
    const startMoment = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${effectiveSelTime}`);
    const rangeEnd = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${targetRange[1]}`);
    // Find next appointment after this start (excluding the one being edited)
    const dateKey = dayjs(date).format('YYYY-MM-DD');
    const empAppts = (appointments?.[dateKey]||[])
      .filter(a => a.employee===assigned && a.time !== effectiveSelTime && a.id !== form.id)
      .sort((a,b)=>a.time.localeCompare(b.time));
    let nextStart = null;
    for(const a of empAppts){ if(a.time > effectiveSelTime){ nextStart = dayjs(`${dateKey}T${a.time}`); break; } }
    const hardEnd = nextStart && nextStart.isBefore(rangeEnd) ? nextStart : rangeEnd;
    let free = hardEnd.diff(startMoment,'minute');
    if(free < 0) free = 0;

    // If there is an effective selected time, prefer precise free-minute checks
    if (effectiveSelTime) {
      if (needed && needed > free) {
        setScheduleError('Η διάρκεια είναι εκτός ορίων εργαζόμενου');
        return;
      }
      // selected time fits
      setScheduleError('');
      return;
    }

    // No selected time: show message if computeAvailableSlots found none for this duration
    if (needed > 0 && Array.isArray(availableSlots) && availableSlots.length === 0) {
      setScheduleError('Δεν υπάρχουν διαθέσιμες ώρες για αυτή τη διάρκεια');
      return;
    }
    // if we reached here, all checks passed; clear scheduleError
    setScheduleError('');
  }, [form.assignedEmployee, form.time, date, appointments, form.id, form.duration, availableSlots, hour, mode]);

  // Centralized recompute routine used by both immediate and debounced effects
  function doRecomputeSlots() {
    // When user leaves duration empty, pass 0 so computeAvailableSlots will
    // treat it as minimal slot size (slotMinutes) and offer every aligned start.
    const durationValue = (form.duration !== '' && form.duration !== undefined && form.duration !== null)
      ? parseInt(form.duration, 10)
      : 0;
    const slots = computeAvailableSlots({
      date,
      assigned: form.assignedEmployee,
      duration: durationValue,
      appointments,
      excludeId: form.id
    });
    setAvailableSlots(prev => {
      if (Array.isArray(prev) && prev.length === slots.length && prev.every((v,i) => v === slots[i])) {
        return prev; // no change
      }
      return slots;
    });
    // Debug: surface computed inputs on occasional tablet issues
    try { console.debug && console.debug('[computeAvailableSlots]', { assigned: form.assignedEmployee, duration: form.duration || form.durationSelect, slots }); } catch(e) {}

  // Note: do NOT automatically clear the user's selected time here.
  // Clearing caused a UX issue where correcting the duration would
  // remove the time and then require the user to re-select it before
  // saving. Validation will enforce correctness; leave the selection
  // intact so fixing duration can immediately enable Save.
  }

  // Immediate recompute for structural changes (employee, appointments, date, id, duration)
  // Also fire when the duration value changes so the slot list updates promptly.
  useEffect(() => {
    doRecomputeSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.assignedEmployee, appointments, date, form.id, form.duration]);

  // Debounced recompute for free-form duration typing to avoid transient clears on touch keyboards
  useEffect(() => {
    const t = setTimeout(() => doRecomputeSlots(), 200);
    return () => clearTimeout(t);
  }, [form.duration]);

  // Load existing appointment data when in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !appointments || (!dateStr && !paramId)) return;

    // Helper to find appointment by id across all loaded dates
    const findByIdGlobal = (id) => {
      for (const k of Object.keys(appointments || {})) {
        const found = (appointments[k] || []).find(apt => String(apt.id) === String(id));
        if (found) return found;
      }
      return null;
    };

    let existingAppointment = null;

    if (paramId) {
      // prefer id lookup when provided
      if (dateStr) {
        const dateKey = dayjs(dateStr).format('YYYY-MM-DD');
        existingAppointment = (appointments[dateKey] || []).find(apt => String(apt.id) === String(paramId)) || null;
      }
      if (!existingAppointment) existingAppointment = findByIdGlobal(paramId);
    }

    // If not found by id, fall back to employee+hour lookup (legacy)
    if (!existingAppointment && dateStr && employeeId && hour) {
      const dateKey = dayjs(dateStr).format('YYYY-MM-DD');
      const dayAppointments = appointments[dateKey] || [];
      existingAppointment = dayAppointments.find(apt => apt.employee === employeeId && apt.time === hour) || null;
    }

    // If we have an id-based appointment but no date param in URL, canonicalize URL to include the date
    if (existingAppointment && paramId && !dateStr && existingAppointment.date) {
      try {
        navigate(`/appointment-form?id=${encodeURIComponent(paramId)}&date=${existingAppointment.date}&mode=edit`, { replace: true });
        return; // will re-run effect with date param
      } catch (e) { /* ignore navigation errors */ }
    }

    if (!existingAppointment) return;

    const duration = existingAppointment.duration || 30;
    setForm({
      id: existingAppointment.id,
      client: existingAppointment.client || '',
      phone: existingAppointment.phone || '',
      description: existingAppointment.description || '',
      clientInfo: existingAppointment.clientInfo || existingAppointment.customerInfo || '',
      price: existingAppointment.price || '',
      paymentType: existingAppointment.paymentType || 'cash',
      durationSelect: '30',
      duration: duration,
      assignedEmployee: existingAppointment.employee || employeeId || '',
      employeeSelect: existingAppointment.displayEmployee || '',
      employeeExplicit: existingAppointment.employeeExplicit || false,
      time: existingAppointment.time || hour || ''
    });
    // keep a reference to the original appointment for edit logic
    originalApptRef.current = existingAppointment;
  }, [mode, appointments, dateStr, employeeId, hour, paramId, navigate]);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.client.trim()) {
      setFormError('Το όνομα είναι υποχρεωτικό');
      return;
    }
    if (!form.phone.trim()) {
      setFormError('Το τηλέφωνο είναι υποχρεωτικό');
      return;
    }
    if (form.duration === '' || form.duration === null || form.duration === undefined) {
      setFormError('Η διάρκεια είναι υποχρεωτική');
      return;
    }
    if (scheduleError) {
      // prevent save if duration exceeds schedule
      return;
    }
    
  const dateKey = dayjs(date).format('YYYY-MM-DD');
  // Final validation: assignedEmployee must be set
  if (!form.assignedEmployee) { setFormError('Πρέπει να επιλέξετε εργαζόμενο'); return; }

    // If we're editing and the user didn't change time but kept same employee, allow using original time
    let effectiveTime = form.time;
    if (!effectiveTime && mode === 'edit' && originalApptRef.current && originalApptRef.current.employee === form.assignedEmployee) {
      effectiveTime = originalApptRef.current.time;
    }
    if (!effectiveTime) { setFormError('Πρέπει να επιλέξετε ώρα'); return; }

  // Defensive overlap check before saving — re-fetch latest appointments to avoid races
    let dayApptsSrc = appointments;
    // attempt fetch with retries/backoff
    async function tryFetchWithRetry(attempts = 3) {
      let lastErr = null;
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await fetchAppointments();
          return res;
        } catch (err) {
          lastErr = err;
          console.warn('appointments fetch attempt', i+1, 'failed:', err?.code || err?.message || err);
          // small backoff
          await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
        }
      }
      throw lastErr;
    }

    try {
      const latest = await tryFetchWithRetry(3);
      dayApptsSrc = latest || appointments;
    } catch (err) {
      // fallback to local in-memory appointments if fetch fails
      console.warn('Could not fetch latest appointments before save, using local state', err?.code || err?.message || err);
    }

    // Build exclusion set for the appointment(s) being edited
    const excludeSet = new Set();
    if (form.id !== undefined && form.id !== null) excludeSet.add(String(form.id));
    if (originalApptRef.current && originalApptRef.current.id !== undefined && originalApptRef.current.id !== null) excludeSet.add(String(originalApptRef.current.id));

    // Determine if we're moving the appointment. If editing and neither employee nor time changed,
    // skip the overlap check (we're only updating fields like price/notes).
    const original = originalApptRef.current;
    const isEdit = mode === 'edit' && original;
    const moving = !isEdit || (String(form.assignedEmployee) !== String(original?.employee) || (effectiveTime !== original?.time));

    if (moving) {
      const dayAppts = (dayApptsSrc?.[dateKey] || []).filter(a => a.employee === form.assignedEmployee && !excludeSet.has(String(a.id)));
      const chosenStart = dayjs(`${dateKey}T${effectiveTime}`);
      const chosenEnd = chosenStart.add(parseInt(form.duration || 30, 10), 'minute');
      const conflict = dayAppts.some(a => {
        const aStart = dayjs(`${dateKey}T${a.time}`);
        const aEnd = aStart.add(parseInt(a.duration || 30, 10), 'minute');
        return chosenStart.isBefore(aEnd) && aStart.isBefore(chosenEnd);
      });
      if (conflict) { setFormError('Η επιλεγμένη ώρα επικαλύπτει υπάρχον ραντεβού'); return; }
    }

    const appointmentData = {
      id: form.id,
      date: dateKey,
      // Move the appointment to the chosen employee/time
      employee: form.assignedEmployee,
      displayEmployee: form.employeeSelect || null,
      time: effectiveTime,
      client: form.client.trim(),
      phone: form.phone.trim(),
      description: form.description.trim(),
      clientInfo: form.clientInfo.trim(),
      price: form.price !== '' ? parseFloat(form.price) : null,
      paymentType: form.paymentType || 'cash',
      // Persist duration as integer when provided; store null when empty to
      // avoid writing undefined to Firestore.
      duration: form.duration !== '' && form.duration !== undefined && form.duration !== null
        ? parseInt(form.duration, 10)
        : null
  ,
  employeeExplicit: !!form.employeeExplicit
    };

    try {
      // Save to Firebase
      const savedId = await saveAppointment(appointmentData);
      // ensure appointmentData has the final id returned by the service
      appointmentData.id = savedId || appointmentData.id;
      backupAppointment('save', appointmentData);
      // Update local in-memory state immediately so UI reflects new price/payment
      try {
        setAppointments(prev => {
          const next = { ...(prev || {}) };
          const list = Array.isArray(next[dateKey]) ? next[dateKey].slice() : [];
          // remove any existing instance of this id
          const filtered = list.filter(a => String(a.id) !== String(appointmentData.id));
          filtered.push(appointmentData);
          next[dateKey] = filtered.sort((a,b)=> (a.time||'').localeCompare(b.time||''));
          return next;
        });
      } catch (err) {
        console.warn('Local appointments update failed (non-blocking):', err);
      }
  // Avoid printing the whole appointment object (can be large). Log a short summary only when debugging.
  if (DEBUG_APPTS) console.log(`Appointment saved: id=${appointmentData.id} date=${appointmentData.date} time=${appointmentData.time}`);

      // Upsert customer profile (fire and forget intentionally after appointment save)
      if (form.phone.trim()) {
        saveCustomer({
          phone: form.phone.trim(),
            name: form.client.trim(),
            client: form.client.trim(),
            description: form.description.trim(),
            clientInfo: form.clientInfo.trim(),
            lastAppointmentAt: new Date().toISOString()
        }).catch(err => console.warn('Customer save error (non-blocking):', err));
      }
      
      // Navigate back to the schedule
      navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`);
    } catch (error) {
      console.error('Error saving appointment:', error);
      if (error && error.code === 'SLOT_CONFLICT' && error.existingId) {
        setFormError('Υπάρχει ήδη ραντεβού σε αυτή την ώρα. Ανοίγω το υπάρχον ραντεβού.');
        try {
          navigate(`/appointment-form?id=${encodeURIComponent(error.existingId)}&mode=edit`);
          return;
        } catch (e) { /* ignore */ }
      }
      setFormError('Σφάλμα κατά την αποθήκευση. Δοκιμάστε ξανά.');
    }
  }

  async function handlePhoneBlur() {
    const phone = form.phone.trim();
    if (!phone) return;
    setCustomerLookupLoading(true);
    setCustomerLoaded(false);
    try {
      const customer = await getCustomerByPhone(phone);
      if (customer) {
        setForm(f => ({
          ...f,
          // Preserve any user-typed description; do NOT copy customer.notes into description
          client: f.client || customer.name || ''
        }));
        if (customer.name) { setNameQuery(customer.name); }
        setCustomerLoaded(true);
      }
    } catch (err) {
      console.warn('Customer lookup failed', err);
    } finally {
      setCustomerLookupLoading(false);
    }
  }

  // Live phone input change handler with debounced search
  useEffect(() => {
    if (!phoneQuery || phoneQuery.replace(/[^0-9]/g, '').length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const results = await searchCustomersByPhonePrefix(phoneQuery, 6);
      if (active) {
        // dedupe by phone
        const dedup = [];
        const seen = new Set();
        for (const r of results) {
          const p = (r.phone || '').trim();
          const key = p || r.id || JSON.stringify(r);
          if (!seen.has(key)) { seen.add(key); dedup.push(r); }
        }
        setCustomerSuggestions(dedup);
        setShowSuggestions(true);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [phoneQuery]);

  // Live name input change handler with debounced search (>=2 chars)
  useEffect(() => {
    if (!nameQuery || nameQuery.trim().length < 2) {
      setNameSuggestions([]);
      setShowNameSuggestions(false);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const results = await searchCustomersByNamePrefix(nameQuery, 6);
      if (active) {
        // dedupe by id+phone
        const dedup = [];
        const seen = new Set();
        for (const r of results) {
          const key = `${r.id || ''}::${(r.phone||'').trim()}::${(r.name||'').trim()}`;
          if (!seen.has(key)) { seen.add(key); dedup.push(r); }
        }
        setNameSuggestions(dedup);
      }
    }, 250);
    return ()=>{ active=false; clearTimeout(t); };
  }, [nameQuery]);

  function handleSelectSuggestion(cust) {
  setForm(prev => ({
      ...prev,
      // don't clear id when editing
      id: mode === 'edit' ? prev.id : undefined,
      client: cust.name || '',
      phone: cust.phone || '',
      // preserve any existing description the user typed in the form
      description: prev.description || '',
      clientInfo: cust.clientInfo || cust.info || '',
      price: cust.price || prev.price || '',
      paymentType: cust.paymentType || prev.paymentType || 'cash',
      durationSelect: '30',
      duration: ''
    }));
  if(cust.name){ setNameQuery(cust.name); }
  setCustomerLoaded(true);
    setShowSuggestions(false);
  }

  function handleDeleteConfirmation() {
    alert('Delete button clicked');
  if (DEBUG_APPTS) console.log('Delete button clicked');
    const confirmMessage = `Είστε σίγουροι ότι θέλετε να διαγράψετε το ραντεβού του/της "${form.client}" στις ${hour}?\n\nΑυτή η ενέργεια δεν μπορεί να αναιρεθεί.`;
    
    if (confirm(confirmMessage)) {
  if (DEBUG_APPTS) console.log('User confirmed deletion');
      handleDelete();
    } else {
  if (DEBUG_APPTS) console.log('User cancelled deletion');
    }
  }

  async function handleDelete() {
    const dateKey = dayjs(date).format('YYYY-MM-DD');
    
    try {
      // Find the appointment ID in Firebase
      const currentAppointments = appointments[dateKey] || [];
      // Prefer id-based delete when available (opened by id). Fall back to employee+hour for legacy routes.
      const appointmentToDelete = currentAppointments.find(apt => {
        if (form.id && String(apt.id) === String(form.id)) return true;
        if (paramId && String(apt.id) === String(paramId)) return true;
        return (employeeId && hour && apt.employee === employeeId && apt.time === hour);
      });
      
      if (appointmentToDelete && appointmentToDelete.id) {
        await deleteAppointment(appointmentToDelete.id);
  // Log the deleted appointment id only when debugging — not the whole object.
  if (DEBUG_APPTS) console.log(`Appointment deleted: id=${appointmentToDelete.id}`);
        alert('Το ραντεβού διαγράφηκε με επιτυχία!');
      } else {
        alert('Δεν βρέθηκε το ραντεβού για διαγραφή.');
      }
      
      navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Σφάλμα κατά τη διαγραφή. Δοκιμάστε ξανά.');
    }
  }

  // Allow opening by id-only when editing (paramId present). Legacy routes still require employee+hour.
  if (!paramId && (!employeeId || !hour)) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" radius="lg" withBorder shadow="md" ta="center">
          <Text c="red">Λάθος παράμετροι. Παρακαλώ επιστρέψτε στο πρόγραμμα.</Text>
          <Button mt="md" onClick={() => navigate('/')}>
            Επιστροφή στο Ημερολόγιο
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size={false} py="md" style={{ maxWidth: '100vw', width: '100vw', margin: 0, padding: 0 }}>
      <Paper 
        p="md" 
        radius="lg" 
        withBorder 
        shadow="lg"
        style={{
          background: 'linear-gradient(135deg, #ffffff, #fff8fc)',
          border: '1px solid rgba(214, 51, 108, 0.25)',
          maxWidth: '100vw',
          width: '100vw',
          margin: 0
        }}
      >
        <Stack gap="md">
          <div>
            <Group justify="space-between" align="flex-start" mb="md">
              <Button 
                variant="subtle" 
                size="sm" 
                onClick={() => navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`)}
                style={{ color: '#d52f74', fontWeight: 600 }}
              >
                ← Πίσω στο Πρόγραμμα
              </Button>
            </Group>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Title 
                order={2} 
                ta="center" 
                c="pink.7" 
                mb="xs"
                style={{ fontSize: 'clamp(18px, 3.5vw, 24px)', margin: 0 }}
              >
                {mode === 'edit' ? 'Επεξεργασία' : 'Νέο'} Ραντεβού
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  title="Προηγούμενη ραντεβού της ημέρας"
                  onClick={() => {
                    const dateKey = dayjs(date).format('YYYY-MM-DD');
                    const dayAppts = (appointments?.[dateKey] || []).slice().sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                    if (!dayAppts || dayAppts.length === 0) return;
                    const employeesOrder = EMPLOYEES.map(e => e.id);
                    const currentId = form.id || (originalApptRef.current && originalApptRef.current.id) || null;
                    const currentTime = form.time || hour || (originalApptRef.current ? originalApptRef.current.time : '');
                    let currentEmployee = form.assignedEmployee || (originalApptRef.current && originalApptRef.current.employee) || employeeId || employeesOrder[0];
                    let empIdx = employeesOrder.indexOf(currentEmployee);
                    if (empIdx === -1) empIdx = 0;

                    const findPrevForEmployee = (empId) => {
                      const list = dayAppts.filter(a => a.employee === empId).sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                      if (!list || list.length === 0) return null;
                      let idx = -1;
                      if (currentId) idx = list.findIndex(a => String(a.id) === String(currentId));
                      if (idx === -1) idx = list.findIndex(a => a.time === currentTime);
                      if (idx === -1) {
                        idx = list.findIndex(a => a.time > currentTime);
                        if (idx === -1) idx = list.length;
                      }
                      const prevIdx = idx - 1;
                      if (prevIdx >= 0) return list[prevIdx];
                      return null;
                    };

                    // try previous in current employee
                    let target = findPrevForEmployee(currentEmployee);
                    if (!target) {
                      // search previous employees in order (left of current)
                      for (let i = empIdx - 1; i >= 0; i--) {
                        const list = dayAppts.filter(a => a.employee === employeesOrder[i]).sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                        if (list.length > 0) { target = list[list.length - 1]; break; }
                      }
                    }

                    if (target) {
                      originalApptRef.current = target;
                      setForm({
                        id: target.id,
                        client: target.client || '',
                        phone: target.phone || '',
                        description: target.description || '',
                        clientInfo: target.clientInfo || target.customerInfo || '',
                        price: target.price || '',
                        paymentType: target.paymentType || 'cash',
                        durationSelect: String(target.duration || 30),
                        duration: target.duration || 30,
                        assignedEmployee: target.employee || '',
                        employeeSelect: target.displayEmployee || '',
                        employeeExplicit: target.employeeExplicit || false,
                        time: target.time || ''
                      });
                      setFormError('');
                    }
                  }}
                  style={{ width: 56, height: 36, borderRadius: 8, border: '1px solid #d6336c', background: '#fff0f6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
                  aria-label="Προηγούμενη ραντεβού"
                >
                  <IconChevronUp size={18} color="#d6336c" />
                </button>
                <button
                  type="button"
                  title="Επόμενη ραντεβού της ημέρας"
                  onClick={() => {
                    const dateKey = dayjs(date).format('YYYY-MM-DD');
                    const dayAppts = (appointments?.[dateKey] || []).slice().sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                    if (!dayAppts || dayAppts.length === 0) return;
                    const employeesOrder = EMPLOYEES.map(e => e.id);
                    const currentId = form.id || (originalApptRef.current && originalApptRef.current.id) || null;
                    const currentTime = form.time || hour || (originalApptRef.current ? originalApptRef.current.time : '');
                    let currentEmployee = form.assignedEmployee || (originalApptRef.current && originalApptRef.current.employee) || employeeId || employeesOrder[0];
                    let empIdx = employeesOrder.indexOf(currentEmployee);
                    if (empIdx === -1) empIdx = 0;

                    const findNextForEmployee = (empId) => {
                      const list = dayAppts.filter(a => a.employee === empId).sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                      if (!list || list.length === 0) return null;
                      let idx = -1;
                      if (currentId) idx = list.findIndex(a => String(a.id) === String(currentId));
                      if (idx === -1) idx = list.findIndex(a => a.time === currentTime);
                      if (idx === -1) {
                        idx = list.findIndex(a => a.time > currentTime);
                        if (idx === -1) idx = list.length;
                      }
                      let nextIdx;
                      if (idx === list.length) return null;
                      if (idx !== -1 && list[idx] && (String(list[idx].id) === String(currentId) || list[idx].time === currentTime)) {
                        nextIdx = idx + 1;
                      } else {
                        nextIdx = idx;
                      }
                      if (nextIdx < 0 || nextIdx >= list.length) return null;
                      return list[nextIdx];
                    };

                    // try next in current employee
                    let target = findNextForEmployee(currentEmployee);
                    if (!target) {
                      // search next employees in order (right of current)
                      for (let i = empIdx + 1; i < employeesOrder.length; i++) {
                        const list = dayAppts.filter(a => a.employee === employeesOrder[i]).sort((a,b)=> (a.time||'').localeCompare(b.time||''));
                        if (list.length > 0) { target = list[0]; break; }
                      }
                    }

                    if (target) {
                      originalApptRef.current = target;
                      setForm({
                        id: target.id,
                        client: target.client || '',
                        phone: target.phone || '',
                        description: target.description || '',
                        clientInfo: target.clientInfo || target.customerInfo || '',
                        price: target.price || '',
                        paymentType: target.paymentType || 'cash',
                        durationSelect: String(target.duration || 30),
                        duration: target.duration || 30,
                        assignedEmployee: target.employee || '',
                        employeeSelect: target.displayEmployee || '',
                        employeeExplicit: target.employeeExplicit || false,
                        time: target.time || ''
                      });
                      setFormError('');
                    }
                  }}
                  style={{ width: 56, height: 36, borderRadius: 8, border: '1px solid #d6336c', background: '#fff0f6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}
                  aria-label="Επόμενη ραντεβού"
                >
                  <IconChevronDown size={18} color="#d6336c" />
                </button>
              </div>
            </div>
            
            <Text ta="center" c="dimmed" size="lg" fw={500}>
              {employee?.name} • {form.time || hour}
            </Text>
            {/* Employee choice buttons for moving the appointment (edit-only) */}
            {mode === 'edit' && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {EMPLOYEES.map(emp => {
                const active = form.assignedEmployee === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, assignedEmployee: emp.id }));
                      setFormError('');
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: active ? '2px solid #d6336c' : '1px solid #e6a0bf',
                      background: active ? '#ffeef5' : '#fff',
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 600
                    }}
                  >
                    {emp.name}
                  </button>
                );
              })}
              </div>
            )}
            {/* Time select (available slots for chosen employee) - edit-only */}
            {mode === 'edit' && (
              <div style={{ marginTop: 8 }}>
                <label htmlFor="timeSelect" style={{ display: 'block', fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center' }}>
                  Ώρα (επιλέξτε για αλλαγή)
                </label>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <select
                      id="timeSelect"
                      value={form.time}
                      onChange={e => {
                        setForm(f => ({ ...f, time: e.target.value }));
                        setFormError('');
                      }}
                      style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #d6336c', background: '#fff', textAlign: 'center', minWidth: 160 }}
                    >
                      <option value="">(επιλέξτε ώρα)</option>
                      {availableSlots.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <Text ta="center" c="dimmed" size="sm">
              {dayjs(date).format('dddd, DD MMM YYYY')}
            </Text>
          </div>

          <Divider />

          {/* Form */}
          <form onSubmit={handleSave} style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
            <Stack gap="md" align="center" style={{ textAlign: 'center' }}>
        <div style={{ position:'relative', width:'100%' }}>
          <TextInput
            label="Όνομα Πελάτισσας"
            placeholder="Εισάγετε το όνομα"
            value={form.client}
            onChange={(e) => {
              const val = e.target.value;
              setForm(f => ({ ...f, client: val }));
              setNameQuery(val);
              setShowNameSuggestions(true);
            }}
            onBlur={() => { setTimeout(()=>{ setShowNameSuggestions(false); }, 160); }}
            onFocus={() => { if(nameSuggestions.length>0) setShowNameSuggestions(true); }}
            onKeyDown={(e)=>{ if(e.key==='Escape'){ e.stopPropagation(); setShowNameSuggestions(false);} }}
            required
            size="md"
            styles={{
              root: { width: '100%' },
              label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
              input: { fontSize: 14, padding: '8px 10px', textAlign: 'center' }
            }}
          />
          {showNameSuggestions && nameSuggestions.length>0 && (
            <Paper
              withBorder
              shadow="md"
              radius="md"
              p={4}
              style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', width:'100%', zIndex:31, marginTop:4, maxHeight:180, overflowY:'auto', background:'#fff', border:'2px solid #e86aa6', boxShadow:'0 6px 18px -4px rgba(214,51,108,0.35)' }}
            >
              <Stack gap={4} style={{ width:'100%' }}>
                {nameSuggestions.map(cust => (
                  <Button
                    key={cust.id+cust.phone}
                    variant="subtle"
                    size="compact-sm"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(cust); setNameSuggestions([]); setShowNameSuggestions(false); }}
                    styles={{ root: { justifyContent:'flex-start', width:'100%', padding:'6px 8px' } }}
                  >
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.1 }}>
                      <span style={{ fontWeight:600 }}>{cust.name || '—'}</span>
                      <span style={{ color:'#888', fontSize:11 }}>{cust.phone}</span>
                    </div>
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}
        </div>

              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <TextInput
                  label="Τηλέφωνο"
                  placeholder="69XXXXXXXX"
                  value={form.phone}
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="tel"
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); // keep only digits
                    setForm(f => ({ ...f, phone: val }));
                    setPhoneQuery(val);
                    setShowSuggestions(true);
                    setShowNameSuggestions(false); // hide name suggestions if user moves to entering phone
                  }}
                  onBlur={handlePhoneBlur}
                  description={customerLookupLoading ? 'Αναζήτηση πελάτη/σας...' : (customerLoaded ? 'Βρέθηκαν στοιχεία πελάτη/σας' : undefined)}
                  size="md"
                  styles={{
                    root: { width: '100%', maxWidth: 360, margin: '0 auto' },
                    label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                    input: { fontSize: 14, padding: '8px 10px', textAlign: 'center', letterSpacing: '0.5px' }
                  }}
                />
                {showSuggestions && customerSuggestions.length > 0 && (
                  <Paper
                    withBorder
                    shadow="md"
                    radius="md"
                    p={4}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      maxWidth: 360,
                      zIndex: 30,
                      marginTop: 4,
                      maxHeight: 180,
                      overflowY: 'auto',
                      background: '#fff',
                      border: '2px solid #e86aa6',
                      boxShadow: '0 6px 18px -4px rgba(214,51,108,0.35)'
                    }}
                  >
                    <Stack gap={4} style={{ width: '100%' }}>
                      {customerSuggestions.map(cust => (
                        <Button
                          key={cust.id}
                          variant="subtle"
                          size="compact-sm"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(cust); }}
                          styles={{ root: { justifyContent: 'flex-start', width: '100%', padding: '6px 8px' } }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                            <span style={{ fontWeight: 600 }}>{cust.name || '—'}</span>
                            <span style={{ color: '#888', fontSize: 11 }}>{cust.phone}</span>
                          </div>
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </div>

            <NumberInput
                label="Διάρκεια (λεπτά)"
                placeholder="π.χ. 30"
                value={form.duration === '' ? '' : form.duration}
                onChange={(val) => {
                  setForm(f => ({ ...f, duration: val === '' ? '' : val }));
                  setFormError('');
                }}
                required
                min={5}
                max={480}
                step={5}
                clampBehavior="blur" /* allow temporary out-of-range / empty while typing */
                inputMode="numeric"
                allowDecimal={false}
                hideControls
                size="md"
                styles={{
                  root: { width: '100%' },
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                  input: { fontSize: 14, padding: '5px 6px', textAlign: 'center' }
                }}
              />
              {scheduleError && (
                <Text size="xs" c="red.7" fw={600} style={{ marginTop: -6 }}>
                  {scheduleError}
                </Text>
              )}

              
              <Textarea
                label="Περιγραφή"
                placeholder=""
                autosize
                minRows={2}
                maxRows={4}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                styles={{
                  root: { width: '100%' },
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                  input: {
                    background: '#fff',
                    border: '1px solid rgba(214,51,108,0.35)',
                    fontSize: 14,
                    borderRadius: 8,
                    textAlign: 'center'
                  }
                }}
              />
              <Textarea
                label="Πληροφορίες Πελάτισσας"
                placeholder="Προτιμήσεις, ιστορικό..."
                autosize
                minRows={2}
                maxRows={6}
                value={form.clientInfo}
                onChange={(e) => setForm(f => ({ ...f, clientInfo: e.target.value }))}
                styles={{
                  root: { width: '100%' },
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                  input: {
                    background: '#fff',
                    border: '1px solid rgba(214,51,108,0.35)',
                    fontSize: 14,
                    borderRadius: 8,
                    textAlign: 'center'

                  }
                }}
              />

              <TextInput
                label="Τιμή (€)"
                placeholder="Τιμή"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') }))}
                size="md"
                style={{ width: '100%', maxWidth: 180, margin: '0 auto' }}
                inputMode="decimal"
                
              />
              <div style={{ width: '100%', maxWidth: 180, margin: '15px  auto'}}>
                <label htmlFor="paymentType" style={{ display: 'block', fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' }}>
                  Τρόπος Πληρωμής
                </label>
                <select
                  id="paymentType"
                  value={form.paymentType}
                  onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}
                  style={{ width: '100%', padding: '5px 6px', borderRadius: 8, border: '1px solid #d6336c', fontSize: 14, textAlign: 'center', background: '#fff' }}
                >
                  <option value="cash">Μετρητά</option>
                  <option value="card">Κάρτα</option>
                </select>
              </div>
              <div style={{ width: '100%', maxWidth: 220, margin: '8px auto' }}>
                <label htmlFor="employeeSelect" style={{ display: 'block', fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' }}>
                  Προτιμηση εργαζόμενου
                </label>
                <select
                  id="employeeSelect"
                  value={form.employeeSelect}
                  onChange={e => setForm(f => ({ ...f, employeeSelect: e.target.value, employeeExplicit: !!e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #d6336c', fontSize: 14, textAlign: 'center', background: '#fff' }}
                >
                  <option value="">(εργαζόμενοι)</option>
                  {EMPLOYEES.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <Text size="sm" c="red.7" fw={500} ta="center">
                  {formError}
                </Text>
              )}
              {scheduleError && !formError && (
                <Text size="sm" c="red.7" fw={500} ta="center">
                  {scheduleError}
                </Text>
              )}

              <Divider my="md" />

              <Group justify="space-between" gap="md">
                <Button
                  variant="subtle"
                  color="gray"
                  size="md"
                  onClick={() => navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`)}
                  style={{ flex: 1 }}
                >
                  Άκυρο
                </Button>
                
                
                
                {(() => {
                  const canSave = !!form.client.trim() && !!form.phone.trim() && (form.duration !== '' && form.duration != null) && !formError && !scheduleError;
                  return (
                    <Button
                      type="submit"
                      size="md"
                      // Force strong visible styling (some iPhones rendered the default as near-white)
                      variant="filled"
                      disabled={!canSave}
                  style={{
                        flex: mode === 'edit' ? 1 : 2,
                        background: (!canSave) ? '#fbe0eb' : '#d6336c',
                        color: (!canSave) ? '#c2255c' : '#ffffff',
                    border: '1px solid #d6336c',
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    boxShadow: (!form.client.trim() || !!formError || !!scheduleError) ? 'none' : '0 3px 8px -3px rgba(214,51,108,0.55)',
                    transition: 'background-color 160ms ease, box-shadow 160ms ease'
                  }}
                  styles={{
                    root: {
                          '&:hover': (!canSave)
                            ? { background: '#f7d1de' }
                            : { background: '#c2255c' }
                    }
                  }}
                >
                  {mode === 'edit' ? 'Ενημέρωση' : 'Αποθήκευση'} Ραντεβού
                </Button>
                  );
                })()}
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
