import { useState, useEffect } from 'react';
import { Paper, Stack, Title, Text, Divider, Button, TextInput, Textarea, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DatePicker } from '@mantine/dates';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/el';
dayjs.locale('el');
import { BUSINESS_HOURS } from './ScheduleGrid';
import { loadAllWaitlist, removeWaiting } from '../services/waitlistService';
import { purgeAppointmentsBefore } from '../services/appointmentService';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useRef, useCallback } from 'react';

// Helper: render a single month grid using the same day styling as DatePicker
function Month({ monthStart, onPick }) {
  const start = dayjs(monthStart).startOf('month');
  const end = start.endOf('month');
  const days = [];
  // Build grid: from start of month to end, keep each day
  for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
    days.push(d);
  }

  const weeks = [];
  let week = [];
  // Prepend blanks for first week according to weekday (Monday-first)
  const firstWeekday = (start.day() + 6) % 7; // shift so Monday=0, Sunday=6
  for (let i = 0; i < firstWeekday; i++) week.push(null);
  days.forEach(d => {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  // Remove any weeks that are completely before the current week so the
  // calendar always starts at the week that contains today.
  // Use Monday as the start of week (Monday-first layout)
  const startOfCurrentWeek = dayjs().startOf('day').subtract((dayjs().day() + 6) % 7, 'day');
  const filteredWeeks = weeks.filter(w => w.some(d => d && !d.isBefore(startOfCurrentWeek, 'day')));

  const onDayClick = (d) => {
    if (!d) return;
  const dayNum = d.day();
  const conf = BUSINESS_HOURS[dayNum];
  const isPast = dayjs().isAfter(d, 'day');
  if (!conf || isPast) return; // disabled day or already passed
  onPick(d.toDate());
  };

  return (
    <div style={{ width: '100%', marginBottom: 18, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: '#d52f74' }}>{start.format('MMMM YYYY')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: '6px 12px' }}>
        {['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'].map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: 12, color: '#666', fontWeight: 700 }}>{h}</div>
        ))}
  {filteredWeeks.flat().map((d, i) => {
          if (!d) return <div key={`blank-${i}`} />;
          const isToday = dayjs().isSame(d, 'day');
          const dayNum = d.day();
          const conf = BUSINESS_HOURS[dayNum];
          const isPast = dayjs().isAfter(d, 'day');
          const disabled = !conf || isPast;
          const style = {
            fontSize: 'clamp(12px, 2vw, 14px)',
            height: 'clamp(36px, 5vw, 44px)',
            width: '100%',
            borderRadius: 8,
            fontWeight: 600,
            cursor: disabled ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isToday ? 'linear-gradient(135deg, rgba(214,51,108,0.18), rgba(214,51,108,0.05))' : '#fff',
            border: isToday ? '2px solid #d6336c' : '1px solid rgba(0,0,0,0.04)',
            color: isPast ? '#999' : (disabled ? 'rgba(0,0,0,0.3)' : undefined),
            opacity: disabled ? (isToday ? 0.5 : 0.6) : 1,
            textDecoration: isPast ? 'line-through' : 'none'
          };
          return (
            <div key={d.toString()} onClick={() => onDayClick(d)} style={style} aria-disabled={disabled}>
              {d.date()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthScroller({ currentDate, onPick }) {
  const containerRef = useRef(null);
  // start with only current month + one future month; append on scroll
  const INITIAL_COUNT = 2; // current + (INITIAL_COUNT-1) future months
  const APPEND_COUNT = 2; // how many months to append when scrolling
  const [months, setMonths] = useState(() => {
    const list = [];
    const start = dayjs(currentDate).startOf('month');
    for (let i = 0; i < INITIAL_COUNT; i++) list.push(start.add(i, 'month').toDate());
    return list;
  });

  const loadingRef = useRef(false);
  const scrollTimerRef = useRef(null);

  const maybeLoadMore = useCallback(() => {
    const el = containerRef.current;
    if (!el || loadingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    // only load more future months when scrolling near bottom (no past months)
    if (scrollTop + clientHeight > scrollHeight - 160) {
      loadingRef.current = true;
      const prevScrollTop = el.scrollTop;
      const prevScrollHeight = el.scrollHeight;
      setMonths(prev => {
        const last = dayjs(prev[prev.length - 1]).startOf('month');
        const add = [];
        for (let i = 1; i <= APPEND_COUNT; i++) add.push(last.add(i, 'month').toDate());
        return [...prev, ...add];
      });
      // allow render and then restore scrollTop to avoid jumpiness
      setTimeout(() => {
        try {
          const el2 = containerRef.current;
          if (el2) {
            // preserve user's viewport roughly
            el2.scrollTop = Math.min(prevScrollTop, el2.scrollHeight - el2.clientHeight);
          }
        } catch (e) {}
        loadingRef.current = false;
      }, 120);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => maybeLoadMore(), 80);
    };
    el.addEventListener('scroll', onScroll);
    // ensure current month is visible at top on first mount
    setTimeout(() => { if (containerRef.current) containerRef.current.scrollTop = 0; }, 40);
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return (
    <div ref={containerRef} style={{ maxHeight: 360, overflowY: 'auto', width: '100%', padding: 8 }}>
      {months.map(m => <Month key={m.toString()} monthStart={m} onPick={onPick} />)}
    </div>
  );
}

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
    // when date picked we still navigate to appointments, but keep the global waitlist view
    (async ()=>{
      const arr = await loadAllWaitlist();
      setWaitlist(arr);
    })();
  }

  // ensure waitlist updates when `date` changes
  // load full waitlist once and whenever component mounts
  useEffect(() => {
    (async ()=>{
      const arr = await loadAllWaitlist();
      setWaitlist(arr);
    })();
  }, []);

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
          {/* Scrollable month list (lazy loaded). Replaces single DatePicker for infinite scroll UX. */}
          <MonthScroller currentDate={date} onPick={handlePick} />
          
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
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="xs" onClick={() => navigate(`/waitlist`)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconPlus size={14}/>Προσθήκη</span>
                </Button>
                <Button size="xs" color="gray" variant="subtle" onClick={async () => {
                  try{
                    const arr = await loadAllWaitlist();
                    setWaitlist(arr || []);
                    console.log('Reloaded full waitlist', arr);
                    alert(`Ανανεώθηκαν ${arr?.length || 0} εγγραφές αναμονής`);
                  }catch(e){
                    console.error('Failed to reload waitlist', e);
                    alert('Αποτυχία ανανέωσης αναμονών — δείτε την κονσόλα');
                  }
                }}>Ανανέωση</Button>
              </div>
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
                        <Button size="xs" color="gray" variant="subtle" onClick={() => navigate(`/waitlist?id=${w.id}`)}>
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
                    const ok = await removeWaiting(/* dateStr not required for server delete */ null, confirmDelete.id);
                    if(ok === false) throw new Error('remove failed');
                    const arr = await loadAllWaitlist();
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
