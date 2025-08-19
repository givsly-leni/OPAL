import { useMemo } from 'react';
import { Stack, Title, Text, Paper, Alert } from '@mantine/core';
import styles from './DateSelectorStep.module.css';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DatePicker } from '@mantine/dates';
import dayjs from 'dayjs';

// Mirror business hours logic for open/closed indication
const BUSINESS_HOURS = {
  0: null,
  1: null,
  2: { start: 10, end: 21 },
  3: { start: 10, end: 21 },
  4: { start: 10, end: 21 },
  5: { start: 9, end: 21 },
  6: { start: 9, end: 15 },
};

export function DateSelectorStep({ selectedDate, onChange, onContinue }) {
  const info = useMemo(() => {
    const dayNum = dayjs(selectedDate).day();
    const conf = BUSINESS_HOURS[dayNum];
    if (!conf) return { closed: true, label: 'Closed' };
    return { closed: false, label: `${String(conf.start).padStart(2,'0')}:00 - ${String(conf.end).padStart(2,'0')}:00` };
  }, [selectedDate]);

  return (
    <Stack gap="lg" align="center" p="md" className={styles.wrapper}>
      <Title order={2} c="brand.7">Κλείσε Ραντεβού</Title>
  <Paper p="lg" radius="xl" withBorder shadow="md" className={styles.innerPaper}>
        <Stack gap="md">
          <Stack gap={2}>
            <Text fw={500} size="sm" c="dimmed">Επίλεξε ημέρα</Text>
            <DatePicker
              value={selectedDate}
              onChange={(val) => { onChange(val); if (val) { const dayNum = dayjs(val).day(); const conf = BUSINESS_HOURS[dayNum]; if (conf) onContinue(); } }}
              fullWidth
              size="xs"
              withCellSpacing={false}
              hideOutsideDates
              previousIcon={<IconChevronLeft size={14} stroke={2} />}
              nextIcon={<IconChevronRight size={14} stroke={2} />}
              getDayProps={(d) => {
                const dayNum = dayjs(d).day();
                const conf = BUSINESS_HOURS[dayNum];
                const isToday = dayjs().isSame(d, 'day');
                if (!conf) {
                  return { disabled: true, style: { opacity: isToday ? 0.5 : 0.25, border: isToday ? '1px solid #d6336c' : undefined, background: isToday ? 'rgba(214,51,108,0.08)' : undefined } };
                }
                return { style: { fontSize:12, height:32, width:32, borderRadius:8, fontWeight:600, background: isToday ? 'linear-gradient(135deg, rgba(214,51,108,0.25), rgba(214,51,108,0.07))' : undefined, border: isToday ? '2px solid #d6336c' : undefined, color: isToday ? '#a51147' : undefined } };
              }}
              styles={{
                calendarHeader: { justifyContent:'space-between', marginBottom:4 },
                calendarHeaderControl: { width:28, height:28, minWidth:28, borderRadius:8 },
                calendarHeaderLevel: { fontSize:14, fontWeight:600, color:'#d52f74' },
                day: { fontWeight:500 },
              }}
            />
          </Stack>
          {info.closed ? (
            <Alert color="red" variant="light" title="Κλειστά">
              Το κατάστημα είναι κλειστό αυτή την ημέρα. Διάλεξε άλλη ημέρα.
            </Alert>
          ) : (
            <Alert color="green" variant="light" title="Ώρες Λειτουργίας">
              {info.label}
            </Alert>
          )}
          <Text ta="center" size="xs" c="dimmed">{dayjs(selectedDate).format('dddd, DD MMM YYYY')}</Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
