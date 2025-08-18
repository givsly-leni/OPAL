import { useState } from 'react';
import { Table, Text, Group, Badge, ActionIcon, Button, Stack, Alert, Paper } from '@mantine/core';
import styles from './ScheduleGrid.module.css';
import { IconPlus, IconX, IconPencil } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { deleteAppointment } from '../services/appointmentService';
import dayjs from 'dayjs';

// Employees (columns)
const EMPLOYEES = [
  { id: 'aggelikh', name: 'Aggelikh' },
  { id: 'emmanouela', name: 'Emmanouela' },
  { id: 'hliana', name: 'Hliana' },
];

// Color accents per employee (Mantine color name + shade or custom hex)
const EMPLOYEE_COLORS = {
  aggelikh: 'pink',
  emmanouela: 'violet',
  hliana: 'teal'
};

// Minimum width for each employee column (responsive)
const EMPLOYEE_CELL_MIN_WIDTH = 'clamp(140px, 18vw, 200px)';

// Business hours per weekday (0=Sunday ... 6=Saturday). null means closed.
// Sunday (0) closed, Monday (1) closed, Tue/Wed/Thu 10-21, Fri 9-21, Sat 9-15
export const BUSINESS_HOURS = {
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

export function ScheduleGrid({ date, appointments, setAppointments }) {
  // appointments[dateKey] = [{ client, phone, duration, description, employee, time, id }]
  const [deleteState, setDeleteState] = useState({ opened:false, employeeId:null, hour:null, client:'' });
  const navigate = useNavigate();
  const dateKey = dayjs(date).format('YYYY-MM-DD');
  const hours = generateHoursForDate(date);
  const dayAppointments = appointments[dateKey] || [];

  // Helper function to get appointment for specific employee and hour
  function getAppointment(employeeId, hour) {
    return dayAppointments.find(apt => apt.employee === employeeId && apt.time === hour);
  }

  function employeeBookedHours(employeeId){ 
    return dayAppointments
      .filter(apt => apt.employee === employeeId)
      .map(apt => apt.time);
  }

  function openNew(employeeId, hour) {
    navigate(`/appointment-form?date=${dayjs(date).format('YYYY-MM-DD')}&employee=${employeeId}&hour=${hour}&mode=new`);
  }
  
  function openEdit(employeeId, hour) {
    navigate(`/appointment-form?date=${dayjs(date).format('YYYY-MM-DD')}&employee=${employeeId}&hour=${hour}&mode=edit`);
  }

  function openDelete(employeeId,hour){ 
    const appointment = getAppointment(employeeId, hour);
    const client = appointment?.client || ''; 
    setDeleteState({ opened:true, employeeId, hour, client }); 
  }
  
  async function confirmDelete(){ 
    if(deleteState.employeeId && deleteState.hour){ 
      const appointment = getAppointment(deleteState.employeeId, deleteState.hour);
      if (appointment && appointment.id) {
        try {
          console.log('Deleting appointment from Firebase:', appointment.id);
          await deleteAppointment(appointment.id);
          console.log('Appointment successfully deleted');
        } catch (error) {
          console.error('Error deleting appointment:', error);
          // You might want to show an error message to the user here
        }
      }
    } 
    setDeleteState({ opened:false, employeeId:null, hour:null, client:'' }); 
  }

  // Closed day
  if (hours.length === 0) {
    return (
      <Stack gap="sm">
        <Alert color="yellow" title="Κλειστά" variant="light">Το κατάστημα είναι κλειστό αυτή την ημέρα.</Alert>
      </Stack>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      padding: '0 8px',
      boxSizing: 'border-box'
    }}>
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
          overflowX: 'auto'
        }}
      >
        <div style={{ flex: 1, minWidth: '320px', width: '100%' }}>
          <Table 
            stickyHeader 
            horizontalSpacing="xs" 
            verticalSpacing={6} 
            fontSize="sm" 
            className={styles.tableRoot}
            style={{ minWidth: 'fit-content' }}
          >
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
              {hours.map(hour=>{
                const now = dayjs();
                const isToday = now.isSame(date,'day');
                const isCurrentHour = isToday && now.format('HH:00')===hour;
                return (
                  <Table.Tr key={hour} className={isCurrentHour? styles.currentHour:undefined}>
                    <Table.Td 
                      className={styles.timeCell}
                      style={{
                        fontSize: 'clamp(11px, 2vw, 13px)',
                        padding: 'clamp(4px, 1vw, 6px) clamp(6px, 1.5vw, 8px)',
                        width: 'clamp(60px, 8vw, 80px)'
                      }}
                    >
                      {hour}
                    </Table.Td>
                    {EMPLOYEES.map((e,idx)=>{ 
                      const appt = getAppointment(e.id, hour); 
                      const color=EMPLOYEE_COLORS[e.id]||'gray'; 
                      return (
                        <Table.Td 
                          key={e.id} 
                          className={styles.empCell} 
                          style={{ 
                            borderRight: idx===EMPLOYEES.length-1? 'none':'1px solid rgba(214,51,108,0.25)', 
                            minWidth: EMPLOYEE_CELL_MIN_WIDTH,
                            padding: 'clamp(2px, 0.5vw, 4px) clamp(3px, 0.8vw, 6px)'
                          }}
                        >
                          {appt ? (
                            <Paper withBorder radius="sm" p="2px 4px" className={styles.apptPaper}>
                              <Badge
                                color={color}
                                variant="filled"
                                radius="sm"
                                className={styles.apptBadge}
                                onClick={()=>openEdit(e.id,hour)}
                                title={`${appt.client}${appt.duration? ' • '+appt.duration+'′':''}${appt.phone? '\n'+appt.phone:''}${appt.description? '\n'+appt.description:''}` }
                                style={{
                                  fontSize: 'clamp(9px, 1.8vw, 11px)',
                                  lineHeight: 1.2,
                                  padding: 'clamp(2px, 0.5vw, 4px) clamp(3px, 0.8vw, 6px)',
                                  cursor: 'pointer'
                                }}
                              >
                                {appt.client}{appt.duration? ` (${appt.duration}′)`:''}
                              </Badge>
                              <ActionIcon 
                                size="xs" 
                                variant="light" 
                                color={color} 
                                radius="sm" 
                                onClick={()=>openEdit(e.id,hour)}
                                style={{ minWidth: '20px', minHeight: '20px' }}
                              >
                                <IconPencil size={10}/>
                              </ActionIcon>
                              <ActionIcon 
                                size="xs" 
                                color="red" 
                                variant="subtle" 
                                radius="sm" 
                                onClick={()=>openDelete(e.id,hour)}
                                style={{ minWidth: '20px', minHeight: '20px' }}
                              >
                                <IconX size={10}/>
                              </ActionIcon>
                            </Paper>
                          ) : (
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              color={color}
                              onClick={()=>openNew(e.id,hour)}
                              radius="sm"
                              className={styles.addAction}
                              style={{
                                width: '100%',
                                height: 'clamp(24px, 4vw, 32px)',
                                minHeight: '24px'
                              }}
                            >
                              <IconPlus size={12}/>
                            </ActionIcon>
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
          
        {deleteState.opened && (
          <Paper p="md" radius="md" withBorder shadow="sm" className={styles.deletePanel} mt="md">
            <Stack gap="sm">
              <Text size="sm">
                Να διαγραφεί το ραντεβού {deleteState.client? `της πελάτισσας "${deleteState.client}" `:''}στις {deleteState.hour};
              </Text>
              <Group justify="flex-end" gap="xs">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={()=> setDeleteState({ opened:false, employeeId:null, hour:null, client:'' })}
                >
                  Ακύρωση
                </Button>
                <Button color="red" size="sm" onClick={confirmDelete}>
                  Διαγραφή
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
      </Paper>
    </div>
  );
}
