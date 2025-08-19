import { useState, useMemo } from 'react';
import { Table, Text, Group, Badge, ActionIcon, Stack, Alert, Paper, Button } from '@mantine/core';
import styles from './ScheduleGrid.module.css';
import { IconPlus, IconX, IconPencil } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { deleteAppointment } from '../services/appointmentService';
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

const SLOT_MINUTES = 15; // Granularity reverted to 15-minute frames
const SLOT_PIXEL_HEIGHT = 6; // Adjust height for better visibility per 15-min slot

function generateTimeSlotsForDate(date){
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
  const navigate = useNavigate();
  const dateKey = dayjs(date).format('YYYY-MM-DD');
  const slots = generateTimeSlotsForDate(date);
  const dayAppointments = useMemo(()=> {
    return (appointments[dateKey] || [])
      .map(a => ({ ...a, start: a.time }))
      .sort((a,b) => a.start.localeCompare(b.start));
  }, [appointments, dateKey]);

  const coverageMap = useMemo(()=>{
    const map = {};
    EMPLOYEES.forEach(e => { map[e.id] = {}; });
    dayAppointments.forEach(appt => {
      const start = dayjs(`${dateKey}T${appt.time}`);
      const durationMin = parseInt(appt.duration || 30, 10);
      const slotCount = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
      for (let i=0;i<slotCount;i++) {
        const slotTime = start.add(i * SLOT_MINUTES, 'minute').format('HH:mm');
        map[appt.employee][slotTime] = { appt, isStart: i===0, span: slotCount };
      }
    });
    return map;
  }, [dayAppointments, dateKey]);

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

  async function handleConfirmDelete(){
    if(confirmState.open && confirmState.apptId){
      try { await deleteAppointment(confirmState.apptId); } catch(e){ console.error('Error deleting appointment', e); }
    }
    setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null });
  }
  function handleCancelDelete(){ setConfirmState({ open:false, employeeId:null, slot:null, client:'', apptId:null }); }

  if (slots.length === 0) {
    return (
      <Stack gap="sm">
        <Alert color="yellow" title="Κλειστά" variant="light">Το κατάστημα είναι κλειστό αυτή την ημέρα.</Alert>
      </Stack>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '0 8px', boxSizing: 'border-box' }}>
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
              {slots.map(slot=>{
                const now = dayjs();
                const isToday = now.isSame(date,'day');
                const isCurrentSlot = isToday && now.format('HH:mm')===slot;
                const minutePart = slot.slice(3,5);
                // Show every slot label now
                const displayLabel = slot;
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
                  <Table.Tr key={slot} className={rowClass}>
                    <Table.Td className={styles.timeCell} style={{ fontSize: 'clamp(11px, 2vw, 13px)', fontWeight: 600, opacity: 0.95, padding: '0 3px', lineHeight: 1.15, width: 'clamp(50px, 7vw, 70px)' }}>{displayLabel}</Table.Td>
                    {EMPLOYEES.map((e,idx)=>{ 
                      const startCell = getAppointmentStartCell(e.id, slot);
                      const covered = slotCovered(e.id, slot);
                      const color=EMPLOYEE_COLORS[e.id]||'gray'; 
                      if (covered && !startCell) return null;
                      const working = isEmployeeWorking(e.id, date, slot);
            const apptCellClass = startCell ? styles.apptCellActive : '';
            return (
                        <Table.Td 
                          key={e.id}
                          className={`${styles.empCell} ${!startCell && working ? styles.workingSlot : ''} ${apptCellClass}`}
                          style={{
                            borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)',
                            minWidth: EMPLOYEE_CELL_MIN_WIDTH,
                            padding: '0 2px',
                            verticalAlign: 'middle'
                          }}
                          rowSpan={startCell ? startCell.span : 1}
                        >
                          {startCell ? (
                            <Paper radius="sm" p="2px 4px" className={`${styles.apptPaper} ${styles.apptPaperColored}`} style={{ border:'none', minHeight: `${Math.max(16, Math.max(1,startCell.span) * SLOT_PIXEL_HEIGHT + 8)}px`, display: 'flex', alignItems: 'center', gap: 6, width:'100%' }}>
                              {(() => { 
                                const desc = (startCell.appt.description || '').trim();
                                const firstWord = desc ? desc.split(/\s+/)[0] : '';
                                return (
                                  <Badge
                                    color={color}
                                    variant="filled"
                                    radius="sm"
                                    className={styles.apptBadge}
                                    onClick={()=>openEdit(e.id,slot)}
                                    title={`${startCell.appt.client}${firstWord? ' • '+firstWord:''}${startCell.appt.phone? '\n'+startCell.appt.phone:''}${desc? '\n'+desc:''}`}
                                    style={{ fontSize: 'clamp(10px, 2vw, 13px)', lineHeight: 1.15, padding: '2px 6px', cursor: 'pointer', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff' }}
                                  >
                                    {startCell.appt.client}{firstWord ? ` (${firstWord})` : ''}
                                  </Badge>
                                );
                              })()}
                              <ActionIcon size="xs" variant="light" color={color} radius="sm" onClick={()=>openEdit(e.id,slot)} style={{ minWidth: '12px', minHeight: '12px' }}><IconPencil size={8}/></ActionIcon>
                              <ActionIcon size="xs" color="red" variant="subtle" radius="sm" onClick={()=>openDelete(e.id,slot)} style={{ minWidth: '12px', minHeight: '12px' }}><IconX size={8}/></ActionIcon>
                            </Paper>
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
    </div>
  );
}
