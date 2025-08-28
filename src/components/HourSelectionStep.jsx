import { useMemo, useState } from 'react';
import { Stack, Title, Text, Paper, Button, Alert, Group, SimpleGrid, Badge, SegmentedControl, TextInput, Select, NumberInput, Textarea, Divider, ScrollArea } from '@mantine/core';
import dayjs from 'dayjs';
import { getEmployeeScheduleForDate } from '../services/scheduleService';

const EMPLOYEES = [
  { id: 'aggelikh', name: 'Αγγελικη' },
  { id: 'emmanouela', name: 'Εμμανουελα' },
  { id: 'hliana', name: 'Ηλιανα' },
  { id: 'kelly', name: 'Κέλλυ' },
];

const BUSINESS_HOURS = {
  0: null,
  1: null,
  2: { start: 10, end: 21 },
  3: { start: 10, end: 21 },
  4: { start: 10, end: 21 },
  5: { start: 9, end: 21 },
  6: { start: 9, end: 15 },
};

function generate(date) {
  const dayNum = dayjs(date).day();
  const conf = BUSINESS_HOURS[dayNum];
  if (!conf) return [];
  const arr = [];
  for (let h = conf.start; h <= conf.end; h++) arr.push(`${String(h).padStart(2,'0')}:00`);
  return arr;
}

export function HourSelectionStep({ date, onBack }) {
  // appointments[dayKey][employeeId] = [ { hour, client, phone, duration, description } ]
  const [appointments, setAppointments] = useState({});
  const [employee, setEmployee] = useState('aggelikh');
  const emptyForm = { active: false, hour: null, client: '', phone: '', description: '', durationSelect: '30', duration: 30, editing: false };
  const [form, setForm] = useState(emptyForm);
  const dayKey = dayjs(date).format('YYYY-MM-DD');
  const hours = useMemo(() => generate(date), [date]);

  function normalize(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
      if (typeof item === 'string') { // backward compatibility "HH:00__Client"
        const [hour, client] = item.split('__');
        return { hour, client, phone: '', duration: 30, description: '' };
      }
      return item;
    });
  }

  const bookedRaw = appointments[dayKey]?.[employee] || [];
  const booked = normalize(bookedRaw);
  const bookedHours = booked.map(b => b.hour);

  const DURATION_OPTIONS = ["30","35","40","45","50","55","60","65","70","75","80","85","90","95","100","105","110","115","120","custom"];

  function openNew(h) {
    setForm({ ...emptyForm, active:true, hour:h, editing:false });
  }
  function openExisting(appt) {
    setForm({
      active:true,
      hour: appt.hour,
      client: appt.client,
      phone: appt.phone || '',
      description: appt.description || '',
      duration: appt.duration || 30,
      durationSelect: DURATION_OPTIONS.includes(String(appt.duration)) ? String(appt.duration) : 'custom',
      editing:true
    });
  }

  function save() {
    if (!form.client.trim()) return;
    setAppointments(prev => {
      const next = { ...prev };
      const list = normalize(next[dayKey]?.[employee] || []);
      const idx = list.findIndex(a => a.hour === form.hour);
      const duration = form.durationSelect === 'custom' ? form.duration : parseInt(form.durationSelect, 10);
      const rec = { hour: form.hour, client: form.client.trim(), phone: form.phone.trim(), description: form.description.trim(), duration };
      if (idx >= 0) list[idx] = rec; else list.push(rec);
      if (!next[dayKey]) next[dayKey] = {};
      next[dayKey][employee] = list;
      return next;
    });
    setForm(emptyForm);
  }

  return (
    <Stack gap="lg" p="md" style={{ minHeight:'60vh', width:'100%', alignItems:'stretch' }}>
      <Title order={3} c="brand.7" style={{ letterSpacing:0.5, alignSelf:'center' }}>Επέλεξε Ώρα</Title>
      <Group align="flex-start" gap="xl" wrap="wrap" style={{ width:'100%' }}>
        <Paper p="lg" radius="xl" withBorder shadow="md" style={{ flex:'1 1 620px', maxWidth:680, backdropFilter:'blur(8px)', background:'rgba(255,255,255,0.7)' }}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Text size="sm" c="dimmed">{dayjs(date).format('dddd, DD MMM YYYY')}</Text>
              <Button variant="subtle" size="xs" onClick={onBack}>← Πίσω</Button>
            </Group>
            <SegmentedControl
              fullWidth
              value={employee}
              onChange={setEmployee}
              data={EMPLOYEES.map(e => ({ label: e.name, value: e.id }))}
              radius="xl"
              color="pink"
            />
            {hours.length === 0 && (
              <Alert color="red" variant="light" title="Κλειστά">Κλειστό αυτή την ημέρα.</Alert>
            )}
            <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }} spacing={6}>
              {hours.map(h => {
                // Check employee working ranges for this date
                const ranges = getEmployeeScheduleForDate(employee, date) || [];
                const isWithinSchedule = ranges.some(([rs,re]) => h >= rs && h < re);
                const isBooked = bookedHours.includes(h) || !isWithinSchedule;
                const appt = booked.find(a => a.hour === h);
                const badgeTitle = isBooked && appt ? `${appt.client}${appt.phone ? ' | ' + appt.phone : ''}${appt.duration ? ' | ' + appt.duration + '′' : ''}${appt.description ? '\n' + appt.description : ''}` : undefined;
                return (
                  <Badge
                    key={h}
                    color={isBooked ? 'gray' : 'pink'}
                    variant={isBooked ? 'light' : 'filled'}
                    style={{ cursor: isBooked ? 'not-allowed' : 'pointer', whiteSpace: 'pre-line', textAlign: 'center', fontSize:11, padding:'6px 4px' }}
                    onClick={() => !isBooked && openNew(h)}
                    title={badgeTitle}
                  >
                    {isBooked ? `${h}\n${appt?.client}${appt?.duration ? ' ('+appt.duration+'′)' : ''}` : h}
                  </Badge>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Paper>
        {form.active && (
          <Paper p="lg" radius="xl" withBorder shadow="lg" style={{ flex:'0 0 360px', maxWidth:380, width:'100%', background:'linear-gradient(135deg,#ffffff,#fff7fb)', border:'1px solid rgba(214,51,108,0.35)', display:'flex', flexDirection:'column', maxHeight:'70vh', position:'sticky', top:12 }}>
            <form onSubmit={e=>{e.preventDefault(); save();}} style={{ display:'flex', flexDirection:'column', height:'100%' }}>
              <Stack gap={6} style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
                <Group justify="space-between" align="flex-start" gap={4}>
                  <Text fw={600} size="sm" c="pink.7" style={{ textTransform:'capitalize' }}>{EMPLOYEES.find(e=>e.id===employee)?.name} • {form.hour}</Text>
                  <Button variant="light" size="xs" color="gray" onClick={()=> setForm(emptyForm)}>✕</Button>
                </Group>
                <TextInput
                  label="Όνομα"
                  placeholder="Πελάτισσα"
                  value={form.client}
                  onChange={e=> setForm(f=>({...f, client:e.target.value}))}
                  required
                  size="sm"
                  styles={{ label:{fontSize:12,fontWeight:600,color:'#c2255c'} }}
                />
                <Group grow align="flex-start" gap="sm" wrap="nowrap">
                  <TextInput
                    label="Τηλέφωνο"
                    placeholder="69XXXXXXXX"
                    value={form.phone}
                    onChange={e=> setForm(f=>({...f, phone:e.target.value.replace(/[^0-9+ ]/g,'')}))}
                    size="sm"
                    styles={{ label:{fontSize:12,fontWeight:600,color:'#c2255c'} }}
                  />
                  <Select
                    label="Διάρκεια"
                    value={form.durationSelect}
                    onChange={val=>{ if(!val) return; setForm(f=>({...f, durationSelect:val, duration: val==='custom'? f.duration : parseInt(val,10)})); }}
                    data={DURATION_OPTIONS.map(v=>({ value:v, label: v==='custom'? 'Custom' : v+'′'}))}
                    size="sm"
                    styles={{ label:{fontSize:12,fontWeight:600,color:'#c2255c'} }}
                  />
                  {form.durationSelect==='custom' && (
                    <NumberInput
                      label="Custom"
                      min={5}
                      max={480}
                      step={5}
                      value={form.duration}
                      onChange={val=> setForm(f=>({...f, duration:Number(val)||30}))}
                      size="sm"
                      styles={{ label:{fontSize:12,fontWeight:600,color:'#c2255c'} }}
                    />
                  )}
                </Group>
                <Textarea
                  label="Περιγραφή"
                  placeholder="Σημειώσεις..."
                  autosize
                  minRows={3}
                  maxRows={5}
                  value={form.description}
                  onChange={e=> setForm(f=>({...f, description:e.target.value}))}
                  styles={{
                    label:{fontSize:12,fontWeight:600,color:'#c2255c'},
                    input:{
                      background:'#fff',
                      border:'1px solid rgba(214,51,108,0.35)',
                      fontSize:13,
                      borderRadius:8
                    }
                  }}
                />
              </Stack>
              <Divider my={8} />
              <Group justify="space-between" gap="xs" style={{ paddingTop:2 }}>
                <Button variant="subtle" color="gray" size="xs" radius="md" onClick={()=> setForm(emptyForm)}>Άκυρο</Button>
                <Button type="submit" size="xs" radius="md" disabled={!form.client.trim()} color="pink" variant={form.client.trim()? 'filled':'light'}>
                  {form.editing? 'Ενημέρωση':'Αποθήκευση'}
                </Button>
              </Group>
            </form>
          </Paper>
        )}
      </Group>
    </Stack>
  );
}
