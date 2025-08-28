import { useState, useEffect } from 'react';
import { Paper, Stack, Title, Text, Divider, Button, TextInput, Textarea, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DatePicker } from '@mantine/dates';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/el';
dayjs.locale('el');
import { BUSINESS_HOURS } from './ScheduleGrid';
import { loadWaitlistForDate, removeWaiting } from '../services/waitlistService';
import { purgeAppointmentsBefore } from '../services/appointmentService';
import { IconPlus, IconX } from '@tabler/icons-react';

export function DayCalendar() {
  const [date, setDate] = useState(new Date());
  const navigate = useNavigate();
  const [closedModal, setClosedModal] = useState({ open: false, label: '' });
  const [waitlist, setWaitlist] = useState([]);
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 760 : false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });

  function handlePick(val) {
    if (!val) return;
    setDate(val);
    const dayNum = dayjs(val).day();
    if (!BUSINESS_HOURS[dayNum]) {
      setClosedModal({ open: true, label: dayjs(val).format('dddd DD MMMM YYYY') });
    } else {
      navigate(`/appointment?date=${dayjs(val).format('YYYY-MM-DD')}`);
    }
    // load waitlist for newly selected date (async)
    (async ()=>{
      const arr = await loadWaitlistForDate(dayjs(val).format('YYYY-MM-DD'));
      setWaitlist(arr);
    })();
  }

  // ensure waitlist updates when `date` changes
  useEffect(() => {
    (async ()=>{
      const arr = await loadWaitlistForDate(dayjs(date).format('YYYY-MM-DD'));
      setWaitlist(arr);
    })();
  }, [date]);

  // Responsive: stack waitlist under calendar on narrow screens (phone)
  useEffect(()=>{
    function onResize(){ setIsNarrow(window.innerWidth < 760); }
    window.addEventListener('resize', onResize);
    // set initial
    onResize();
    return () => window.removeEventListener('resize', onResize);
  },[]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100vw',
      minHeight: '100vh',
      padding: 0,
      margin: 0,
      background: 'linear-gradient(135deg, #fff0f6 0%, #f8f9fa 100%)'
    }}>
  <div style={{ display: 'flex', gap: isNarrow ? 12 : 10, width: '100%', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: isNarrow ? 0 : 12, flexDirection: isNarrow ? 'column' : 'row' }}>
  <Paper 
        withBorder 
        shadow="lg" 
        radius="xl" 
        p="xl" 
        style={{ 
          width: '100%',
          maxWidth: isNarrow ? '980px' : '620px',
          minHeight: '420px',
          fontSize: '1.15rem',
          margin: isNarrow ? '24px auto' : '24px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(14px)', 
          background: 'rgba(255,255,255,0.97)',
          border: '1px solid rgba(214,51,108,0.2)'
        }}
      >
        <Stack gap="lg" align="center">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center' }}>
            <Title 
              order={3} 
              ta="center" 
              c="brand.7" 
              style={{ 
                letterSpacing: 0.5,
                fontSize: 'clamp(18px, 3vw, 24px)'
              }}
            >
              Επιλέξτε Ημέρα
            </Title>
            <Button
              component="a"
              href="/customers"
              color="pink"
              variant="light"
              size="md"
              style={{ fontWeight: 600 }}
            >
              Πελάτισσες
            </Button>
            <Button
              color="gray"
              variant="subtle"
              size="md"
              style={{ fontWeight: 600 }}
              onClick={async () => {
                // Preview matches for cutoff = today (delete strictly before today)
                const cutoff = dayjs().format('YYYY-MM-DD');
                try {
                  const preview = await purgeAppointmentsBefore(cutoff, true);
                  const n = preview.matched?.length || 0;
                  if (n === 0) return alert('Δεν βρέθηκαν ραντεβού από προηγούμενες ημέρες για διαγραφή.');
                  if (!confirm(`Βρέθηκαν ${n} ραντεβού πριν από την ${cutoff}. Θέλετε να τα διαγράψετε; Αυτή η ενέργεια δεν μπορεί να ανακληθεί.`)) return;
                  const res = await purgeAppointmentsBefore(cutoff, false);
                  alert(`Διαγράφηκαν ${res.deletedCount || 0} ραντεβού.`);
                } catch (err) {
                  console.error('Purge failed', err);
                  alert('Αποτυχία διαγραφής. Ελέγξτε την κονσόλα για λεπτομέρειες.');
                }
              }}
            >
              Διαγραφή παλιών
            </Button>
          </div>
          <DatePicker
            locale="el"
            value={date}
            onChange={handlePick}
            size="md"
            hideOutsideDates
            withCellSpacing={false}
            previousIcon={<IconChevronLeft size={16} stroke={2} />}
            nextIcon={<IconChevronRight size={16} stroke={2} />}
            getDayProps={(d) => {
              const dayNum = dayjs(d).day();
              const conf = BUSINESS_HOURS[dayNum];
              const isToday = dayjs().isSame(d, 'day');
              if (!conf) {
                return { disabled: true, style: { opacity: isToday ? 0.5 : 0.3, border: isToday ? '1px solid #d6336c' : undefined, background: isToday ? 'rgba(214,51,108,0.08)' : undefined } };
              }
              return {
                style: {
                  fontSize: 'clamp(12px, 2vw, 14px)',
                  height: 'clamp(36px, 5vw, 44px)',
                  width: 'clamp(36px, 5vw, 44px)',
                  borderRadius: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  position: 'relative',
                  background: isToday ? 'linear-gradient(135deg, rgba(214,51,108,0.18), rgba(214,51,108,0.05))' : undefined,
                  border: isToday ? '2px solid #d6336c' : undefined,
                  color: isToday ? '#a51147' : undefined,
                }
              };
            }}
            styles={{
              calendarHeader: { 
                justifyContent: 'space-between', 
                marginBottom: 12 
              },
              calendarHeaderControl: { 
                width: 'clamp(28px, 4vw, 32px)', 
                height: 'clamp(28px, 4vw, 32px)', 
                minWidth: 28, 
                borderRadius: 10 
              },
              calendarHeaderLevel: { 
                fontSize: 'clamp(16px, 3vw, 20px)', 
                fontWeight: 600, 
                color: '#d52f74' 
              },
              monthPickerControl: {
                fontSize: 'clamp(12px, 2vw, 14px)'
              }
            }}
          />
          
          <Divider variant="dashed" style={{ width: '80%' }} />
          
          <Stack gap="xs" align="center">
            <Text 
              size="sm" 
              ta="center" 
              c="dimmed" 
              style={{ fontSize: 'clamp(11px, 2vw, 13px)' }}
            >
              {dayjs(date).format('dddd, DD MMM YYYY')}
            </Text>
            <Text 
              size="xs" 
              c="pink.7" 
              ta="center"
              style={{ fontSize: 'clamp(10px, 2vw, 12px)' }}
            >
              Επιλέξτε μια ημέρα για να δείτε το πρόγραμμα
            </Text>
          </Stack>
        </Stack>
      </Paper>
        {/* Waitlist column */}
  <div style={{ width: isNarrow ? '100%' : 300, display: 'flex', flexDirection: 'column', gap: 10, alignItems: isNarrow ? 'center' : 'flex-start' }}>
          <Paper withBorder shadow="sm" radius="md" p="md" style={{ border: '1px solid rgba(214,51,108,0.12)', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <Title order={4} style={{ margin: 0, fontSize: '1rem' }}>Αναμονές</Title>
                <Text size="xs" c="dimmed">Για πελάτισσες χωρίς διαθέσιμο ραντεβού</Text>
              </div>
              <Button size="xs" onClick={() => navigate(`/waitlist?date=${dayjs(date).format('YYYY-MM-DD')}`)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconPlus size={14}/>Προσθήκη</span>
              </Button>
            </div>
          </Paper>
          <div style={{ maxHeight: 420, overflowY: 'auto', width: '100%' }}>
            {waitlist.length === 0 ? (
              <Paper withBorder radius="md" p="md" style={{ textAlign: 'center', color: '#666' }}>Δεν υπάρχουν αναμονές</Paper>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {waitlist.map(w => (
                  <li key={w.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '6px solid rgba(214,51,108,0.18)', background: '#fffafc', padding: 8, borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{w.name || '—'}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>{w.phone}</div>
                        {w.prefs ? <div style={{ fontSize: 12, color: '#444', marginTop: 6 }}>{w.prefs}</div> : null}
                      </div>
                      <div style={{ marginLeft: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Button size="xs" color="gray" variant="subtle" onClick={() => navigate(`/waitlist?date=${dayjs(date).format('YYYY-MM-DD')}&id=${w.id}`)}>
                          Επεξεργ.
                        </Button>
                        <Button size="xs" color="red" variant="subtle" onClick={() => setConfirmDelete({ open: true, id: w.id, name: w.name || '' })}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconX size={14}/>Αφαίρ.</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {/* Inline closed-day panel to avoid modal interaction problems */}
      {closedModal.open && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 80 }}>
          <Paper withBorder shadow="lg" p="md" style={{ border: '1px solid rgba(214,51,108,0.14)' }}>
            <Stack>
              <Text fw={700}>Κλειστά</Text>
              <Text>Είμαστε κλειστά την ημέρα {closedModal.label}.</Text>
              <Button onClick={() => setClosedModal({ open: false, label: '' })} color="pink">Εντάξει</Button>
            </Stack>
          </Paper>
        </div>
      )}
      {/* Styled confirmation for deleting waitlist entries */}
      {confirmDelete.open && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.32)' }} onClick={() => setConfirmDelete({ open: false, id: null, name: '' })} />
          <Paper withBorder shadow="xl" p="lg" radius="md" style={{ position: 'relative', background: '#fff', color: '#111', width: 420, maxWidth: '94%', zIndex: 131, border: '2px solid rgba(214,51,108,0.18)' }}>
            <Stack spacing="sm">
              <Title order={4} style={{ margin: 0 }}>Διαγραφή Αναμονής</Title>
              <Text>Θέλετε σίγουρα να διαγράψετε την αναμονή για <strong>{confirmDelete.name || 'αυτή την πελάτισσα'}</strong>;</Text>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => setConfirmDelete({ open: false, id: null, name: '' })}>Άκυρο</Button>
                <Button color="red" onClick={async () => {
                  try{
                    const ok = await removeWaiting(dayjs(date).format('YYYY-MM-DD'), confirmDelete.id);
                    if(ok === false) throw new Error('remove failed');
                    const arr = await loadWaitlistForDate(dayjs(date).format('YYYY-MM-DD'));
                    setWaitlist(arr);
                  }catch(err){
                    console.error('Failed to delete waiting', err);
                    setWaitlist(prev => prev.filter(x => x.id !== confirmDelete.id));
                  } finally {
                    setConfirmDelete({ open: false, id: null, name: '' });
                  }
                }}>Διαγραφή</Button>
              </div>
            </Stack>
          </Paper>
        </div>
      )}
  {/* waitlist form moved to separate page (/waitlist) */}
    </div>
  );
}
