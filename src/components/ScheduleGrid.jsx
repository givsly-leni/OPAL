import { useState, useMemo, useCallback, useRef } from 'react';
import { Table, Text, Group, Badge, ActionIcon, Stack, Alert, Paper, Button } from '@mantine/core';
import styles from './ScheduleGrid.module.css';
import { IconPlus, IconX, IconPencil, IconCircleCheck, IconClock, IconPhoneOff, IconStar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { deleteAppointment, saveAppointment } from '../services/appointmentService';
import { backupAppointment } from '../services/backupService';
import dayjs from 'dayjs';
import { Modal } from '@mantine/core';
import { getEmployeeScheduleForDate } from '../services/scheduleService';

// Employees (columns)
const EMPLOYEES = [
  { id: 'aggelikh', name: 'Αγγελική' },
  { id: 'emmanouela', name: 'Εμμανουέλα' },
  { id: 'hliana', name: 'Ηλιάνα' },
  { id: 'kelly', name: 'Κέλλυ' },
];

// Per-employee working hours (weekday -> array of [start,end] ranges, 24h format)
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

// Color accents per employee
const EMPLOYEE_COLORS = {
  aggelikh: 'pink',
  emmanouela: 'violet',
  hliana: 'teal'
  , kelly: 'orange'
};

const EMPLOYEE_CELL_MIN_WIDTH = 'clamp(140px, 18vw, 200px)';

// Business hours (0=Sun ... 6=Sat)
export const BUSINESS_HOURS = {
  0: null,
  1: null,
  2: { start: '10:00', end: '21:00' },
  3: { start: '10:00', end: '21:00' },
  4: { start: '10:00', end: '21:00' },
  5: { start: '09:00', end: '21:00' },
  6: { start: '09:00', end: '15:00' }
};

const SLOT_MINUTES = 15;
const SLOT_PIXEL_HEIGHT = 6;

function generateBaseSlotsForDate(date){
  const dayNum = dayjs(date).day();
  const config = BUSINESS_HOURS[dayNum];
  if (!config) return [];
  const slots = [];
  let cursor = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${config.start}`);
  const end = dayjs(`${dayjs(date).format('YYYY-MM-DD')}T${config.end}`);
  while (cursor.isBefore(end)) {
    slots.push(cursor.format('HH:mm'));
    cursor = cursor.add(SLOT_MINUTES, 'minute');
  }
  return slots;
}

export function ScheduleGrid({ date, appointments, setAppointments }) {
  const [confirmState, setConfirmState] = useState({ open:false, employeeId:null, slot:null, client:'', apptId:null });
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcResult, setCalcResult] = useState({ total: 0, cash: 0, card: 0, count: 0 });

  function handleCalculateDay() {
    let total = 0, cash = 0, card = 0, count = 0;
    (dayAppointments || []).forEach(a => {
      const price = typeof a.price === 'number' ? a.price : parseFloat(a.price);
      if (!isNaN(price)) {
        total += price;
        count++;
        if (a.paymentType === 'cash') cash += price;
        else if (a.paymentType === 'card') card += price;
      }
    });
    setCalcResult({ total, cash, card, count });
    setCalcOpen(true);
  }

  // Drag & drop state and helpers removed — DnD disabled intentionally.

  const navigate = useNavigate();
  const dateKey = dayjs(date).format('YYYY-MM-DD');
  const baseSlots = generateBaseSlotsForDate(date);

  const dayAppointments = useMemo(()=> {
    return (appointments[dateKey] || [])
      .map(a => ({ ...a, start: a.time }))
      .sort((a,b) => a.start.localeCompare(b.start));
  }, [appointments, dateKey]);

  // Helper: determine if an appointment should be considered 'paid'
  const isAppointmentPaid = (appt) => {
    if (!appt) return false;
    const rawPrice = appt.price;
    const parsed = parseFloat(rawPrice);
    return rawPrice !== null && rawPrice !== undefined && rawPrice !== '' && (!isNaN(parsed) || String(rawPrice).trim().length > 0);
  };

  // Phones that appear more than once (shared customers) for the day
  const sharedPhones = useMemo(()=>{
    const map = {};
    (dayAppointments||[]).forEach(a=>{
      const phone = (a.phone||'').trim();
      if(!phone) return;
      if(!map[phone]) map[phone] = new Set();
      map[phone].add(a.employee);
    });
    return new Set(Object.entries(map).filter(([,emps])=>emps.size>1).map(([p])=>p));
  }, [dayAppointments]);

  const SHARED_PHONE_COLORS = ['#ff9800','#2196f3','#4caf50','#9c27b0','#ff5722','#3f51b5','#009688','#bbe9e9ff'];
  const sharedColorCache = useMemo(()=>{
    const cache = {};
    let idx = 0;
    sharedPhones.forEach(p => {
      cache[p] = SHARED_PHONE_COLORS[idx % SHARED_PHONE_COLORS.length];
      idx++;
    });
    return cache;
  }, [sharedPhones]);

  // Dynamic time boundaries
  const slots = useMemo(()=>{
    const set = new Set(baseSlots);
    dayAppointments.forEach(appt => {
      const start = dayjs(`${dateKey}T${appt.time}`);
      const durationMin = parseInt(appt.duration || 30, 10);
      const end = start.add(durationMin, 'minute');
      if (durationMin % SLOT_MINUTES !== 0) {
        set.add(end.format('HH:mm'));
      }
    });
    return Array.from(set).sort();
  }, [baseSlots, dayAppointments, dateKey]);

  const slotIntervals = useMemo(()=>{
    const intervals = {};
    for(let i=0;i<slots.length;i++){
      const cur = slots[i];
      const next = slots[i+1];
      if(next){
        const m = dayjs(`${dateKey}T${next}`).diff(dayjs(`${dateKey}T${cur}`),'minute');
        intervals[cur] = m;
      } else {
        intervals[cur] = SLOT_MINUTES;
      }
    }
    return intervals;
  }, [slots, dateKey]);

  const coverageMap = useMemo(()=>{
    const map = {};
    EMPLOYEES.forEach(e => { map[e.id] = {}; });
    dayAppointments.forEach(appt => {
      const start = dayjs(`${dateKey}T${appt.time}`);
      const durationMin = parseInt(appt.duration || 30, 10);
      const end = start.add(durationMin, 'minute');
      const coveredSlots = slots.filter(s => {
        const sm = dayjs(`${dateKey}T${s}`);
        return (sm.isSame(start) || sm.isAfter(start)) && sm.isBefore(end);
      });
      if(coveredSlots.length===0) return;
      coveredSlots.forEach((s,i)=>{
        map[appt.employee][s] = { appt, isStart: i===0, span: coveredSlots.length };
      });
    });
    return map;
  }, [dayAppointments, dateKey, slots]);

  function getAppointmentStartCell(employeeId, slot) {
    const cell = coverageMap[employeeId]?.[slot];
    return cell && cell.isStart ? cell : null;
  }
  function slotCovered(employeeId, slot) { return !!coverageMap[employeeId]?.[slot]; }

  function isEmployeeWorking(employeeId, dateObj, slot){
    const ranges = getEmployeeScheduleForDate(employeeId, dateObj) || [];
    if(!ranges) return false;
    return ranges.some(([start,end]) => slot >= start && slot < end);
  }

  function getMaxDurationForSlot(employeeId, slot, excludeId){
    const dayNum = dayjs(date).day();
  const ranges = getEmployeeScheduleForDate(employeeId, date) || [];
    const startMoment = dayjs(`${dateKey}T${slot}`);
    let containing = null;
    for(const [rs,re] of ranges){
      if(slot >= rs && slot < re){ containing = [rs,re]; break; }
    }
    if(!containing) return 0;
    const rangeEnd = dayjs(`${dateKey}T${containing[1]}`);
    let nextStart = null;
    const empAppts = (appointments[dateKey]||[])
      .filter(a=>a.employee===employeeId && (!excludeId || a.id !== excludeId))
      .sort((a,b)=>a.time.localeCompare(b.time));
    for(const a of empAppts){
      if(a.time > slot){ nextStart = dayjs(`${dateKey}T${a.time}`); break; }
    }
    const hardEnd = nextStart && nextStart.isBefore(rangeEnd) ? nextStart : rangeEnd;
    let minutes = hardEnd.diff(startMoment,'minute');
    if(minutes < 0) minutes = 0;
    return minutes;
  }

  function openNew(employeeId, slot) {
    navigate(`/appointment-form?date=${dayjs(date).format('YYYY-MM-DD')}&employee=${employeeId}&hour=${slot}&mode=new`);
  }
  function openEdit(employeeId, slot) {
    navigate(`/appointment-form?date=${dayjs(date).format('YYYY-MM-DD')}&employee=${employeeId}&hour=${slot}&mode=edit`);
  }
  function openDelete(employeeId, slot){ 
    const cell = coverageMap[employeeId]?.[slot];
    const appointment = cell?.appt; if(!appointment) return;
    setConfirmState({ open:true, employeeId, slot, client: appointment.client || '', apptId: appointment.id });
  }

  const canPlaceAppointment = useCallback((appt, targetEmployee, targetSlot) => {
    if(!appt) return false;
    const durationMin = parseInt(appt.duration || 30, 10);
    const startMoment = dayjs(`${dateKey}T${targetSlot}`);
    const endMoment = startMoment.add(durationMin,'minute');
    const maxFree = getMaxDurationForSlot(targetEmployee, targetSlot, appt.id);
    if(maxFree < durationMin) return false;
    const overlapping = slots.some(s => {
      const sm = dayjs(`${dateKey}T${s}`);
      if(sm.isSame(startMoment) || (sm.isAfter(startMoment) && sm.isBefore(endMoment))){
        const cell = coverageMap[targetEmployee]?.[s];
        if(cell && cell.appt.id !== appt.id) return true;
      }
      return false;
    });
    if(overlapping) return false;
    return true;
  }, [coverageMap, date, dateKey, slots]);

  // Drag & drop handlers removed — DnD disabled.

  async function handleConfirmDelete(){
    if(confirmState.open && confirmState.apptId){
      try {
        const dateKey = dayjs(date).format('YYYY-MM-DD');
        const appt = (appointments[dateKey]||[]).find(a=>a.id===confirmState.apptId);
        if(appt) backupAppointment('delete', appt);
        await deleteAppointment(confirmState.apptId);
        // Update local state to remove the deleted appointment
        setAppointments(prev => {
          const updated = { ...prev };
          updated[dateKey] = (updated[dateKey] || []).filter(a => a.id !== confirmState.apptId);
          return updated;
        });
      } catch(e){ console.error('Error deleting appointment', e); }
    }
    setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null });
  }
  function handleCancelDelete(){ setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null }); }

  const cycleStatus = async (appt) => {
    if(!appt) return;
    const current = appt.status || 'unconfirmed';
    const next = current === 'unconfirmed' ? 'confirmed' : current === 'confirmed' ? 'no-answer' : 'unconfirmed';
    try {
      const updated = { ...appt, status: next };
      await saveAppointment(updated);
      backupAppointment('save', updated);
    } catch(err){ console.error('Status toggle error', err); }
  };

  const toggleStar = async (appt) => {
    if (!appt) return;
    try {
      const updated = { ...appt, starred: !appt.starred };
      await saveAppointment(updated);
      backupAppointment('save', updated);
    } catch (err) { console.error('Toggle star error', err); }
  };

  if (slots.length === 0) {
    return (
      <Stack gap="sm">
        <Alert color="yellow" title="Κλειστά" variant="light">Το κατάστημα είναι κλειστό αυτή την ημέρα.</Alert>
      </Stack>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '0 8px',
        boxSizing: 'border-box',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        userSelect: 'auto'
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: -8, marginBottom: 6, overflowX: 'auto', padding: '6px 4px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
        <button onClick={() => navigate('/')} style={{ padding: '6px 8px', minWidth: 48, flex: '0 0 auto', border: '1px solid rgba(214,51,108,0.15)', background: '#fff', borderRadius: 8, cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>Πίσω</button>
        <button onClick={() => navigate(`/appointment?date=${dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')}`)} title="Προηγούμενη ημέρα" style={{ flex: '0 0 auto', padding: 6, border: '1px solid rgba(214,51,108,0.15)', background: '#fff', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6L9 12L15 18" stroke="#d6336c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: '0 1 auto', maxWidth: 160, textAlign: 'center', padding: '0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ fontSize: 13 }}>{dayjs(date).format('dddd, DD MMM YYYY')}</strong>
        </div>
        <button onClick={() => navigate(`/appointment?date=${dayjs(date).add(1, 'day').format('YYYY-MM-DD')}`)} title="Επόμενη ημέρα" style={{ flex: '0 0 auto', padding: 6, border: '1px solid rgba(214,51,108,0.15)', background: '#fff', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6L15 12L9 18" stroke="#d6336c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button onClick={handleCalculateDay} style={{ padding: '4px 8px', minWidth: 92,maxWidth:'130px', flex: '0 0 auto', background: '#fff0f6', border: '1px solid #d6336c', color: '#d6336c', borderRadius: 6, cursor: 'pointer',fontSize:'12px' }}>Υπολογισμός Ημέρας</button>
      </div>

      <Paper
        withBorder
        shadow="md"
        radius="xl"
        p="lg"
        style={{
          width: '100%',
          maxWidth: '1200px',
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(214,51,108,0.25)',
          overflowX: 'auto',
          position:'relative',
          userSelect: 'auto',
          WebkitUserSelect: 'auto'
        }}
      >
        <div style={{ flex: 1, minWidth: '320px', width: '100%' }}>
          <Table stickyHeader horizontalSpacing="xs" verticalSpacing={6} fontSize="sm" className={styles.tableRoot} style={{ minWidth: 'fit-content' }}>
            <Table.Thead>
              <Table.Tr className={styles.tableHeadRow}>
                <Table.Th className={styles.hourHeader}>Ώρα</Table.Th>
                {EMPLOYEES.map((e,idx)=>(
                  <Table.Th
                    key={e.id}
                    className={styles.empHeader}
                    style={{
                      borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)',
                      minWidth: EMPLOYEE_CELL_MIN_WIDTH,
                      fontSize: 'clamp(10px, 2vw, 12px)',
                      padding: 'clamp(6px, 1.5vw, 10px) clamp(4px, 1vw, 8px)'
                    }}
                  >
                    {e.name}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {slots.map((slot,slotIdx)=>{
                const now = dayjs();
                const isToday = now.isSame(date,'day');
                const isCurrentSlot = isToday && now.format('HH:mm')===slot;
                const minutePart = slot.slice(3,5);
                const displayLabel = slot;
                const intervalMin = slotIntervals[slot] || SLOT_MINUTES;
                const isHourStart = minutePart === '00';
                const isHalfHour = minutePart === '30';
                const rowClass = isCurrentSlot
                  ? styles.currentHour
                  : isHourStart
                    ? `${styles.hourStripe} ${styles.hourDivider}`
                    : isHalfHour
                      ? `${styles.altHourStripe} ${styles.halfHourDivider}`
                      : `${styles.minorDivider}`;
                return (
                  <Table.Tr key={slot} className={rowClass} style={{ height: `${intervalMin / SLOT_MINUTES * 16}px` }}>
                    <Table.Td className={styles.timeCell} style={{ fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, opacity:0.95, padding: '0 3px', lineHeight: 1.15, width: 'clamp(50px, 7vw, 70px)' }}>{displayLabel}</Table.Td>
                    {EMPLOYEES.map((e,idx)=>{
                      const startCell = getAppointmentStartCell(e.id, slot);
                      const covered = slotCovered(e.id, slot);
                      const color=EMPLOYEE_COLORS[e.id]||'gray';
                      if (covered && !startCell) return null;
                      const working = isEmployeeWorking(e.id, date, slot);
                      let isShared = false; let sharedColor = null;
                      if(startCell){
                        const phoneKey = (startCell.appt.phone||'').trim();
                        isShared = sharedPhones.has(phoneKey);
                        sharedColor = isShared ? sharedColorCache[phoneKey] : null;
                      }
                      // Mark the whole table cell as paid only when the appointment has a numeric price
                      const isPaid = !!startCell && isAppointmentPaid(startCell.appt);
                      if (process.env.NODE_ENV !== 'production' && startCell && startCell.appt) {
                        try {
                          const rawPrice = startCell.appt.price;
                          if ((rawPrice !== null && rawPrice !== undefined && rawPrice !== '') && !isAppointmentPaid(startCell.appt)) {
                            // Avoid logging full appointment objects; log a concise summary instead.
                            console.warn(`[ScheduleGrid] price-present-but-not-paid id=${startCell.appt.id} date=${startCell.appt.date} time=${startCell.appt.time} price=${rawPrice} paymentType=${startCell.appt.paymentType}`);
                          }
                        } catch(e) {}
                      }
                      const apptCellClass = startCell && !isPaid ? styles.apptCellActive : '';
                      const sharedCellStyle = startCell && isShared ? { backgroundColor: sharedColor } : {};
                      const paidCellStyle = isPaid ? { backgroundColor: '#c7ccd4', borderRight: '1px solid rgba(0,0,0,0.16)', transition: 'background-color 120ms ease' } : {};
                      return (
                        <Table.Td
                          key={e.id}
                          className={[
                            styles.empCell,
                            !startCell && working ? styles.workingSlot : '',
                            apptCellClass,
                            '',
                            ''
                          ].join(' ')}
                          style={{
                            borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)',
                            minWidth: EMPLOYEE_CELL_MIN_WIDTH,
                            padding: '0 2px',
                            verticalAlign: 'middle',
                            ...sharedCellStyle,
                            ...paidCellStyle,
                            userSelect: 'auto'
                          }}
                          /* Drag & drop removed */
                          data-emp={e.id}
                          data-slot={slot}
                          rowSpan={startCell ? startCell.span : 1}
                        >
                          {startCell ? (
                            (() => {
                              const sharedStyle = isShared ? {
                                background: sharedColor,
                                color:'#fff'
                              } : {};
                              const status = startCell.appt.status || 'unconfirmed';
                              let statusStyle = {};
                              // Consider appointment paid only if it has a numeric price
                              const isPaid = isAppointmentPaid(startCell.appt);
                              if (process.env.NODE_ENV !== 'production' && startCell && startCell.appt) {
                                try {
                                  const rawPrice = startCell.appt.price;
                                  if ((rawPrice !== null && rawPrice !== undefined && rawPrice !== '') && !isAppointmentPaid(startCell.appt)) {
                                    // Avoid logging full appointment objects; log a concise summary instead.
                                    console.warn(`[ScheduleGrid] price-present-but-not-paid id=${startCell.appt.id} date=${startCell.appt.date} time=${startCell.appt.time} price=${rawPrice} paymentType=${startCell.appt.paymentType}`);
                                  }
                                } catch(e) {}
                              }
                              if (process.env.NODE_ENV !== 'production') {
                                try {
                                  console.debug('[ScheduleGrid] appt-pay-check', {
                                    id: startCell.appt.id,
                                    date: startCell.appt.date,
                                    time: startCell.appt.time,
                                    price: startCell.appt.price,
                                    paymentType: startCell.appt.paymentType,
                                    isPaid
                                  });
                                } catch (e) { /* ignore */ }
                              }
                              // Apply a stronger paid visual to the outer container (Paper)
                              const paidStyle = isPaid ? {
                                backgroundColor: '#bfc7d0',
                                borderRight: '1px solid rgba(0,0,0,0.22)',
                                boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.6), 0 3px 10px rgba(0,0,0,0.10)',
                                color: '#4b5561',
                                cursor: 'default',
                                transform: 'translateY(0.5px)'
                              } : {};
                              const isConfirmed = status === 'confirmed';
                              if(isConfirmed && isShared) {
                                statusStyle = { boxShadow: '0 3px 6px -2px rgba(0,0,0,0.45)' };
                              }
                              // Inner paid styles for icons/buttons inside the appointment
                              const paidInnerStyle = isPaid ? { backgroundColor: paidStyle.backgroundColor, color: paidStyle.color } : {};
                              return (
                                <Paper
                                  /* DnD attributes removed */
                                  radius="sm"
                                  p="2px 4px"
                                  className={`${styles.apptPaper} ${isShared ? styles.sharedApptBase : (!isPaid ? styles.apptPaperColored : '')}`}
                                  style={{
                                    borderWidth: 0,
                                    cursor: 'grab',
                                    minHeight: `${Math.max(30, Math.max(1,startCell.span) * SLOT_PIXEL_HEIGHT + 8)}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    width:'100%',
                                    ...sharedStyle,
                                    ...statusStyle,
                                    ...paidStyle,
                                    WebkitTapHighlightColor: 'transparent',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    touchAction: 'manipulation'
                                  }}
                                >
                                  {(() => { 
                                    const fullName = (startCell.appt.client || '').trim();
                                    const clientFirst = fullName ? fullName.split(/\s+/)[0] : '';
                                    const desc = (startCell.appt.description || '').trim();
                                    const firstDescWord = desc ? desc.split(/\s+/)[0] : '';
                                    return (
                                      <Badge
                                        color={color}
                                        variant="filled"
                                        radius="sm"
                                        className={styles.apptBadge}
                                        onClick={()=>openEdit(e.id,slot)}
                                        title={`${fullName}${firstDescWord? ' • '+firstDescWord:''}${startCell.appt.phone? '\n'+startCell.appt.phone:''}${desc? '\n'+desc:''}`}
                                            style={{
                                            fontSize: 'clamp(10px, 2vw, 13px)',
                                            lineHeight: 1.15,
                                            padding: '2px 6px',
                                            cursor: 'pointer',
                                            backgroundColor: 'rgba(255,255,255,0.18)',
                                            borderWidth: 0,
                                            color: '#fff',
                                            userSelect: 'none',
                                            ...(isPaid ? { backgroundColor: paidStyle.backgroundColor || '#bfc7d0', color: paidStyle.color || '#4b5561' } : {})
                                          }}
                                      >
                                        {(() => {
                                          // Only show an employee initial if it was explicitly
                                          // selected when creating/editing the appointment.
                                          if (!startCell.appt.employeeExplicit) {
                                            return <span>{clientFirst}{firstDescWord ? ` (${firstDescWord})` : ''}</span>;
                                          }
                                          const empId = startCell.appt.displayEmployee || startCell.appt.employee || startCell.appt.employeeId || e.id;
                                          const emp = EMPLOYEES.find(x=>x.id===empId);
                                          const initial = emp ? emp.name.charAt(0) : (empId ? empId.charAt(0).toUpperCase() : '');
                                          return (
                                            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                                              {initial ? <strong style={{ marginRight:4, fontSize:12 }}>({initial})</strong> : null}
                                              <span>{clientFirst}{firstDescWord ? ` (${firstDescWord})` : ''}</span>
                                            </span>
                                          );
                                        })()}
                                      </Badge>
                                    );
                                  })()}
                                  {(() => {
                                    const status = startCell.appt.status || 'unconfirmed';
                                    let icon = <IconClock size={14}/>;
                                    let statusColor = 'gray';
                                    let title = 'Μη επιβεβαιωμένο';
                                    let variant = 'outline';
                                    const extraStyle = { };
                                    if(status==='confirmed'){
                                      icon = <IconCircleCheck size={14}/>;
                                      statusColor='green';
                                      title='Επιβεβαιωμένο';
                                      variant='filled';
                                      extraStyle.backgroundColor = '#2e7d32';
                                      extraStyle.color = '#fff';
                                    } else if(status==='no-answer'){
                                      icon = <IconPhoneOff size={14}/>;
                                      statusColor='red';
                                      title='Δεν το σήκωσε';
                                      variant='filled';
                                      extraStyle.backgroundColor = '#c92a2a';
                                      extraStyle.color = '#fff';
                                    }
                                    return (
                                      <ActionIcon
                                        size="sm"
                                        variant={variant}
                                        color={statusColor}
                                        radius="sm"
                                        title={title + ' (κλικ για αλλαγή)'}
                                        onClick={(ev)=>{ ev.stopPropagation(); cycleStatus(startCell.appt); }}
                                        style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center', ...extraStyle, ...paidInnerStyle }}
                                      >
                                        {icon}
                                      </ActionIcon>
                                    );
                                  })()}
                                  {(() => {
                                    const isStarred = !!startCell.appt.starred;
                                    const starStyle = isStarred
                                      ? { backgroundColor: '#2e7d32', color: '#fff' }
                                      : { backgroundColor: '#f2f4f6', color: '#6b6f73' };
                                    const title = isStarred ? 'Αγαπημένο (απενεργοποίηση)' : 'Σημείωση ως αγαπημένο';
                                    return (
                                      <ActionIcon
                                        size="sm"
                                        variant={isStarred ? 'filled' : 'subtle'}
                                        color={isStarred ? 'green' : undefined}
                                        radius="sm"
                                        title={title}
                                        onClick={(ev)=>{ ev.stopPropagation(); toggleStar(startCell.appt); }}
                                        style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center', ...starStyle, ...paidInnerStyle }}
                                      >
                                        <IconStar size={14} />
                                      </ActionIcon>
                                    );
                                  })()}

                                  <ActionIcon size="sm" color="red" variant="subtle" radius="sm" onClick={()=>openDelete(e.id,slot)} title="Διαγραφή" style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center', ...paidInnerStyle }}><IconX size={14}/></ActionIcon>
                                </Paper>
                              );
                            })()
                          ) : (
                            working ? (
                              <button
                                onClick={() => openNew(e.id, slot)}
                                className={`${styles.addAction} plusButton`}
                                style={{
                                  width: '100%',
                                  height: '18px',
                                  minHeight: '18px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0 6px',
                                  border: '1px dashed rgba(214,51,108,0.4)',
                                  backgroundColor: 'rgba(34,197,94,0.08)',
                                  WebkitTapHighlightColor: 'transparent',
                                  userSelect: 'none',
                                  touchAction: 'manipulation',
                                  cursor: 'pointer',
                                  position: 'relative'
                                }}
                                data-emp={e.id}
                                data-slot={slot}
                                title={`Νέο ραντεβού στις ${slot}`}
                              >
                                <span style={{ fontSize: 12, color: '#166534', fontWeight: 700, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{slot}</span>
                              </button>
                            ) : (
                              <div
                                style={{
                                  width:'100%',
                                  height:'14px',
                                  minHeight:'14px',
                                  opacity:0.25,
                                  background:'repeating-linear-gradient(45deg, #f5f0f3, #f5f0f3 4px, #ece2e7 4px, #ece2e7 8px)',
                                  border:'1px solid rgba(214,51,108,0.15)',
                                  borderRadius:4,
                                  WebkitTapHighlightColor: 'transparent',
                                  userSelect:'none'
                                }}
                                title="Εκτός ωραρίου"
                                data-emp={e.id}
                                data-slot={slot}
                              />
                            )
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>

        {confirmState.open && (
          <>
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.15)', backdropFilter:'blur(2px)', zIndex:2999 }} onClick={handleCancelDelete} />
            <div style={{ position:'fixed', top:32, left:'50%', transform:'translateX(-50%)', zIndex:3000, width:'min(380px, 92%)' }}>
              <Paper shadow="xl" radius="lg" withBorder p="md" style={{ background:'#fff', border:'2px solid #d6336c', boxShadow:'0 4px 12px -2px rgba(214,51,108,0.45)', position:'relative' }}>
                <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#fff', padding:'4px 10px', border:'1px solid #d6336c', borderRadius:12, fontSize:12, fontWeight:600, color:'#d6336c' }}>⚠️</div>
                <Stack gap={8} mt={4}>
                  <Text size="sm" fw={700} c="red.7" ta="center" style={{ letterSpacing:0.5 }}>Επιβεβαίωση Διαγραφής</Text>
                  <Text size="xs" ta="center" c="dark.6" style={{ lineHeight:1.3 }}>
                    Θέλετε σίγουρα να διαγράψετε το ραντεβού {confirmState.client && <strong style={{ color:'#c2255c' }}>{confirmState.client}</strong>} στις <strong style={{ color:'#c2255c' }}>{confirmState.slot}</strong>;
                  </Text>
                  <Group gap="xs" mt={4} justify="center" style={{ flexWrap:'nowrap' }}>
                    <Button size="xs" variant="outline" color="gray" onClick={handleCancelDelete} style={{ flex:1, minWidth:90 }}>Άκυρο</Button>
                    <Button size="xs" color="red" onClick={handleConfirmDelete} style={{ flex:1, minWidth:90 }}>Διαγραφή</Button>
                  </Group>
                </Stack>
              </Paper>
            </div>
          </>
        )}
      </Paper>

      {calcOpen &&  <div opened={calcOpen} title="Σύνολο Ημέρας" centered >
        <Stack gap={8}>
          <Text size="lg" fw={700} c="pink.7">Σύνολο: {calcResult.total.toFixed(2)} €</Text>
          <Text size="sm">Μετρητά: {calcResult.cash.toFixed(2)} €</Text>
          <Text size="sm">Κάρτα: {calcResult.card.toFixed(2)} €</Text>
          <Text size="sm" c="dimmed">Ραντεβού: {calcResult.count}</Text>
          <Button mt="md" color="pink" variant="light" onClick={() => setCalcOpen(false)}>Κλείσιμο</Button>
        </Stack>
      </div>
      }
    </div>
  );
}
