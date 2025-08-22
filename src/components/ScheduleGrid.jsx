import { useState, useMemo, useCallback } from 'react';
import { Table, Text, Group, Badge, ActionIcon, Stack, Alert, Paper, Button } from '@mantine/core';
import styles from './ScheduleGrid.module.css';
import { IconPlus, IconX, IconPencil, IconCircleCheck, IconClock, IconPhoneOff } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { deleteAppointment, saveAppointment } from '../services/appointmentService';
import { backupAppointment } from '../services/backupService';
import dayjs from 'dayjs';

// Employees (columns)
const EMPLOYEES = [
  { id: 'aggelikh', name: 'Αγγελικη' },
  { id: 'emmanouela', name: 'Εμμανουελα' },
  { id: 'hliana', name: 'Ηλιανα' },
];

// Per-employee working hours (weekday -> array of [start,end] ranges, 24h format)
// 0=Sunday ... 6=Saturday
const EMPLOYEE_SCHEDULE = {
  aggelikh: {
    2: [['10:00','16:00'], ['19:00','21:00']], // Tuesday
    3: [['13:00','21:00']], // Wednesday
    4: [['10:00','16:00'], ['19:00','21:00']], // Thursday
    5: [['13:00','21:00']], // Friday
    // 6: day off (Saturday)
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
};

// Color accents per employee
const EMPLOYEE_COLORS = {
  aggelikh: 'pink',
  emmanouela: 'violet',
  hliana: 'teal'
};

const EMPLOYEE_CELL_MIN_WIDTH = 'clamp(140px, 18vw, 200px)';

// Business hours per weekday (0=Sunday ... 6=Saturday). null means closed.
// Sunday (0) closed, Monday (1) closed, Tue/Wed/Thu 10-21, Fri 9-21, Sat 9-15
export const BUSINESS_HOURS = {
  0: null,
  1: null,
  2: { start: '10:00', end: '21:00' },
  3: { start: '10:00', end: '21:00' },
  4: { start: '10:00', end: '21:00' },
  5: { start: '09:00', end: '21:00' },
  6: { start: '09:00', end: '15:00' }
};

// Revert to 15-minute base grid; will handle exceptional durations specially later.
const SLOT_MINUTES = 15;
const SLOT_PIXEL_HEIGHT = 6;

// Generate base 15-min slot boundaries for the day (without dynamic subdivision)
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

import { Modal } from '@mantine/core';

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
  const [dragState, setDragState] = useState({ dragging:false, sourceEmployee:null, sourceSlot:null, appt:null, touchStart:null });
  const [hoverTarget, setHoverTarget] = useState({ employee:null, slot:null, allowed:false });
  const navigate = useNavigate();
  const dateKey = dayjs(date).format('YYYY-MM-DD');
  const baseSlots = generateBaseSlotsForDate(date);
  const dayAppointments = useMemo(()=> {
    return (appointments[dateKey] || [])
      .map(a => ({ ...a, start: a.time }))
      .sort((a,b) => a.start.localeCompare(b.start));
  }, [appointments, dateKey]);

  // Phones that appear on more than one employee (shared customer) for the day
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

  // Distinct solid colors for each shared phone (duplicates). Repeats after palette end.
  const SHARED_PHONE_COLORS = [
    '#ff9800', // orange
    '#2196f3', // blue
    '#4caf50', // green
    '#9c27b0', // purple
    '#ff5722', // deep orange
    '#3f51b5', // indigo
    '#009688', // teal
    '#e91e63'  // pink
  ];
  const sharedColorCache = useMemo(()=>{
    const cache = {};
    let idx = 0;
    sharedPhones.forEach(p => {
      cache[p] = SHARED_PHONE_COLORS[idx % SHARED_PHONE_COLORS.length];
      idx++;
    });
    return cache;
  }, [sharedPhones]);

  // Build dynamic slots: base 15' boundaries plus any appointment end times that fall between them (for exact durations like 40').
  const slots = useMemo(()=>{
    const set = new Set(baseSlots);
    dayAppointments.forEach(appt => {
      const start = dayjs(`${dateKey}T${appt.time}`);
      const durationMin = parseInt(appt.duration || 30, 10);
      const end = start.add(durationMin, 'minute');
      if (durationMin % SLOT_MINUTES !== 0) {
        // inject end boundary if within business hours and not already present
        const endStr = end.format('HH:mm');
        set.add(endStr);
      }
    });
    // Sort times lexicographically (HH:mm fixed width) into array
    return Array.from(set).sort();
  }, [baseSlots, dayAppointments, dateKey]);

  // Precompute next-slot map for variable interval minutes
  const slotIntervals = useMemo(()=>{
    const intervals = {};
    for(let i=0;i<slots.length;i++){
      const cur = slots[i];
      const next = slots[i+1];
      if(next){
        const m = dayjs(`${dateKey}T${next}`).diff(dayjs(`${dateKey}T${cur}`),'minute');
        intervals[cur] = m;
      } else {
        intervals[cur] = SLOT_MINUTES; // default for last row
      }
    }
    return intervals;
  }, [slots, dateKey]);

  // Coverage map now respects dynamic boundaries; partial final segments produce additional slot entries.
  const coverageMap = useMemo(()=>{
    const map = {};
    EMPLOYEES.forEach(e => { map[e.id] = {}; });
    dayAppointments.forEach(appt => {
      const start = dayjs(`${dateKey}T${appt.time}`);
      const durationMin = parseInt(appt.duration || 30, 10);
      const end = start.add(durationMin, 'minute');
      // Determine which slot starts fall within [start, end)
      const coveredSlots = slots.filter(s => {
        const sm = dayjs(`${dateKey}T${s}`);
        return (sm.isSame(start) || sm.isAfter(start)) && sm.isBefore(end);
      });
      if(coveredSlots.length===0){
        return;
      }
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
    const dayNum = dayjs(dateObj).day();
    const ranges = EMPLOYEE_SCHEDULE[employeeId]?.[dayNum];
    if(!ranges) return false;
    // slot = 'HH:mm' – simple string compare works since fixed width
    return ranges.some(([start,end]) => slot >= start && slot < end);
  }

    function getMaxDurationForSlot(employeeId, slot, excludeId){
      const dayNum = dayjs(date).day();
      const ranges = EMPLOYEE_SCHEDULE[employeeId]?.[dayNum] || [];
      const startMoment = dayjs(`${dateKey}T${slot}`);
      // find working range containing slot
      let containing = null;
      for(const [rs,re] of ranges){
        if(slot >= rs && slot < re){ containing = [rs,re]; break; }
      }
      if(!containing) return 0;
      const rangeEnd = dayjs(`${dateKey}T${containing[1]}`);
      // find next appointment start (could be non-15 if previously added)
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
      return minutes; // no rounding; allow arbitrary minute durations
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
    // Ensure fits in free window
    const maxFree = getMaxDurationForSlot(targetEmployee, targetSlot, appt.id);
    if(maxFree < durationMin) return false;
    // Overlap check: any covered slot whose start < end and >= start belonging to other appt
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

  // For mobile: don't start drag on touchstart, but on first touchmove
  const [pendingTouchDrag, setPendingTouchDrag] = useState(null);
  const handleDragStart = (e, employeeId, slot, appt) => {
    if (e.type === 'touchstart') {
      setPendingTouchDrag({ employeeId, slot, appt, start: { x: e.touches[0].clientX, y: e.touches[0].clientY } });
    } else {
      e.dataTransfer.effectAllowed = 'move';
      setDragState({ dragging:true, sourceEmployee:employeeId, sourceSlot:slot, appt, touchStart: null });
    }
  };
  const handleDragEnd = () => {
    setDragState({ dragging:false, sourceEmployee:null, sourceSlot:null, appt:null, touchStart:null });
    setHoverTarget({ employee:null, slot:null, allowed:false });
  };

  // Touch support for mobile drag-and-drop
  const handleTouchMove = (e) => {
    // If not dragging yet, but a touch drag is pending, start drag now
    if (pendingTouchDrag && e.touches && e.touches.length > 0) {
      setDragState({ dragging:true, sourceEmployee:pendingTouchDrag.employeeId, sourceSlot:pendingTouchDrag.slot, appt:pendingTouchDrag.appt, touchStart: { x: e.touches[0].clientX, y: e.touches[0].clientY } });
      setPendingTouchDrag(null);
    }
    if (!dragState.dragging || !dragState.touchStart) return;
    // Prevent scrolling while dragging
    e.preventDefault();
    // Optionally, you could show a visual indicator here
  };

  const handleTouchEnd = (e, employeeId, slot) => {
    // If drag never started, clear pending
    if (pendingTouchDrag) {
      setPendingTouchDrag(null);
      return;
    }
    if (!dragState.dragging) return;
    // Find the element under the touch end
    const touch = e.changedTouches[0];
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    // Try to find the cell with data-emp and data-slot attributes
    let targetCell = elem;
    while (targetCell && (!targetCell.dataset || !targetCell.dataset.emp || !targetCell.dataset.slot)) {
      targetCell = targetCell.parentElement;
    }
    if (targetCell && targetCell.dataset.emp && targetCell.dataset.slot) {
      // Simulate drop
      handleDrop({ preventDefault:()=>{}, dragging:true }, targetCell.dataset.emp, targetCell.dataset.slot);
    }
    handleDragEnd();
  };
  const handleDragOver = (e, employeeId, slot) => {
    if(!dragState.dragging) return;
    e.preventDefault();
    const allowed = canPlaceAppointment(dragState.appt, employeeId, slot);
    setHoverTarget(prev => (prev.employee===employeeId && prev.slot===slot && prev.allowed===allowed) ? prev : { employee:employeeId, slot, allowed });
    e.dataTransfer.dropEffect = allowed ? 'move' : 'none';
  };
  const handleDrop = async (e, employeeId, slot) => {
    if(!dragState.dragging) return;
    e.preventDefault();
    const appt = dragState.appt;
    const allowed = canPlaceAppointment(appt, employeeId, slot);
    if(!allowed) { handleDragEnd(); return; }
    try {
      // Save updated appointment (keep same id, change employee/time)
  const updated = { ...appt, employee: employeeId, time: slot, date: dateKey };
  await saveAppointment(updated);
  backupAppointment('save', updated);
    } catch(err){ console.error('Drag move save error', err); }
    handleDragEnd();
  };

  async function handleConfirmDelete(){
    if(confirmState.open && confirmState.apptId){
      try {
        // attempt to capture the appointment data before deletion
        const appt = (appointments[dayjs(date).format('YYYY-MM-DD')]||[]).find(a=>a.id===confirmState.apptId);
        if(appt) backupAppointment('delete', appt);
        await deleteAppointment(confirmState.apptId);
      } catch(e){ console.error('Error deleting appointment', e); }
    }
    setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null });
  }
  function handleCancelDelete(){ setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null }); }

  // Cycle appointment status: unconfirmed -> confirmed -> no-answer -> unconfirmed
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

  if (slots.length === 0) {
    return (
      <Stack gap="sm">
        <Alert color="yellow" title="Κλειστά" variant="light">Το κατάστημα είναι κλειστό αυτή την ημέρα.</Alert>
      </Stack>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '0 8px', boxSizing: 'border-box' }}>
      <Button color="pink" variant="light" onClick={handleCalculateDay} style={{ marginTop: '-65px' }}>
        Υπολογισμός Ημέρας
      </Button>
      <Paper withBorder shadow="md" radius="xl" p="lg" style={{ width: '100%', maxWidth: '1200px', background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(214,51,108,0.25)', overflowX: 'auto', position:'relative' }}>
        <div style={{ flex: 1, minWidth: '320px', width: '100%' }}>
          <Table stickyHeader horizontalSpacing="xs" verticalSpacing={6} fontSize="sm" className={styles.tableRoot} style={{ minWidth: 'fit-content' }}>
            <Table.Thead>
              <Table.Tr className={styles.tableHeadRow}>
                <Table.Th className={styles.hourHeader}>Ώρα</Table.Th>
                {EMPLOYEES.map((e,idx)=>(
                  <Table.Th key={e.id} className={styles.empHeader} style={{ borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)', minWidth: EMPLOYEE_CELL_MIN_WIDTH, fontSize: 'clamp(10px, 2vw, 12px)', padding: 'clamp(6px, 1.5vw, 10px) clamp(4px, 1vw, 8px)' }}>{e.name}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {slots.map((slot,slotIdx)=>{
                const now = dayjs();
                const isToday = now.isSame(date,'day');
                const isCurrentSlot = isToday && now.format('HH:mm')===slot;
                const minutePart = slot.slice(3,5);
                // Show label for every slot (including dynamically inserted boundaries)
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
                      const apptCellClass = startCell ? styles.apptCellActive : '';
                      const sharedCellStyle = startCell && isShared ? { background: sharedColor } : {};
            return (
                        <Table.Td 
                          key={e.id}
                          className={`${styles.empCell} ${!startCell && working ? styles.workingSlot : ''} ${apptCellClass} ${dragState.dragging && hoverTarget.employee===e.id && hoverTarget.slot===slot ? (hoverTarget.allowed? styles.dropTargetAllowed : styles.dropTargetBlocked) : ''}`}
                          style={{
                            borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)',
                            minWidth: EMPLOYEE_CELL_MIN_WIDTH,
                            padding: '0 2px',
                            verticalAlign: 'middle'
                          , ...sharedCellStyle }}
                          onDragOver={(ev)=>handleDragOver(ev,e.id,slot)}
                          onDrop={(ev)=>handleDrop(ev,e.id,slot)}
                          data-emp={e.id}
                          data-slot={slot}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={ev => handleTouchEnd(ev, e.id, slot)}
                          rowSpan={startCell ? startCell.span : 1}
                        >
                          {startCell ? (
                            (() => {
                              const sharedStyle = isShared ? {
                                background: sharedColor,
                                color:'#fff'
                              } : {};
                              // Status-based color tweak: make confirmed appointments green.
                              const status = startCell.appt.status || 'unconfirmed';
                              let statusStyle = {};
                              const isConfirmed = status === 'confirmed';
                              // Only add outline for confirmed shared appointments; do NOT override background for single appointments.
                              if(isConfirmed && isShared) {
                                statusStyle = { boxShadow: '0 3px 6px -2px rgba(0,0,0,0.45)' };
                              }
                              return (
                                <Paper draggable onDragStart={(ev)=>handleDragStart(ev,e.id,slot,startCell.appt)} onDragEnd={handleDragEnd}
                                  onTouchStart={ev=>handleDragStart(ev,e.id,slot,startCell.appt)}
                                  radius="sm" p="2px 4px" className={`${styles.apptPaper} ${isShared? styles.sharedApptBase : styles.apptPaperColored}`} style={{ border:'none', cursor:'grab', minHeight: `${Math.max(30, Math.max(1,startCell.span) * SLOT_PIXEL_HEIGHT + 8)}px`, display: 'flex', alignItems: 'center', gap: 4, width:'100%', ...sharedStyle, ...statusStyle }}>
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
                                        style={{ fontSize: 'clamp(10px, 2vw, 13px)', lineHeight: 1.15, padding: '2px 6px', cursor: 'pointer', background:'rgba(255,255,255,0.18)', border:'none', color:'#fff' }}
                                      >
                                        {clientFirst}{firstDescWord ? ` (${firstDescWord})` : ''}
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
                                        style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center', ...extraStyle }}
                                      >
                                        {icon}
                                      </ActionIcon>
                                    );
                                  })()}
                                  <ActionIcon size="sm" variant="light" color={color} radius="sm" onClick={()=>openEdit(e.id,slot)} title="Επεξεργασία" style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}><IconPencil size={14}/></ActionIcon>
                                  <ActionIcon size="sm" color="red" variant="subtle" radius="sm" onClick={()=>openDelete(e.id,slot)} title="Διαγραφή" style={{ width:21, height:21, minWidth:21, minHeight:21, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}><IconX size={14}/></ActionIcon>
                                </Paper>
                              );
                            })()
                          ) : (
                            working ? (
                              <ActionIcon
                                variant="transparent"
                                size="sm"
                                color={color}
                                onClick={()=>openNew(e.id,slot)}
                                radius="sm"
                                className={`${styles.addAction} plusButton`}
                                style={{
                                  width:'100%',
                                  height:'14px',
                                  minHeight:'14px',
                                  display:'flex',
                                  alignItems:'center',
                                  justifyContent:'center',
                                  padding:0,
                                  border:'1px dashed rgba(214,51,108,0.4)',
                                  background:'rgba(34,197,94,0.08)'
                                }}
                              >
                                <IconPlus size={10}/>
                              </ActionIcon>
                            ) : (
                              <div style={{ width:'100%', height:'14px', minHeight:'14px', opacity:0.25, background:'repeating-linear-gradient(45deg, #f5f0f3, #f5f0f3 4px, #ece2e7 4px, #ece2e7 8px)', border:'1px solid rgba(214,51,108,0.15)', borderRadius:4 }} title="Εκτός ωραρίου" />
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
