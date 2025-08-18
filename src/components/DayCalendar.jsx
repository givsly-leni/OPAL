import { useState } from 'react';
import { Paper, Stack, Title, Text, Divider, Modal, Button } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { DatePicker } from '@mantine/dates';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { BUSINESS_HOURS } from './ScheduleGrid';

export function DayCalendar() {
  const [date, setDate] = useState(new Date());
  const navigate = useNavigate();
  const [closedModal, setClosedModal] = useState({ open: false, label: '' });

  function handlePick(val) {
    if (!val) return;
    setDate(val);
    const dayNum = dayjs(val).day();
    if (!BUSINESS_HOURS[dayNum]) {
      setClosedModal({ open: true, label: dayjs(val).format('dddd DD MMMM YYYY') });
    } else {
      navigate(`/appointment?date=${dayjs(val).format('YYYY-MM-DD')}`);
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100%',
      padding: '20px'
    }}>
      <Paper 
        withBorder 
        shadow="lg" 
        radius="xl" 
        p="xl" 
        style={{ 
          width: '100%',
          maxWidth: '420px',
          backdropFilter: 'blur(14px)', 
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(214,51,108,0.2)'
        }}
      >
        <Stack gap="lg" align="center">
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
          
          <DatePicker
            value={date}
            onChange={handlePick}
            size="md"
            hideOutsideDates
            withCellSpacing={false}
            previousIcon={<IconChevronLeft size={16} stroke={2} />}
            nextIcon={<IconChevronRight size={16} stroke={2} />}
            getDayProps={(date) => {
              const dayNum = dayjs(date).day();
              const conf = BUSINESS_HOURS[dayNum];
              return !conf ? 
                { disabled: true, style: { opacity: 0.3 } } : 
                { 
                  style: { 
                    fontSize: 'clamp(12px, 2vw, 14px)', 
                    height: 'clamp(36px, 5vw, 44px)', 
                    width: 'clamp(36px, 5vw, 44px)', 
                    borderRadius: 12, 
                    fontWeight: 500,
                    cursor: 'pointer'
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
      
      <Modal 
        opened={closedModal.open} 
        onClose={() => setClosedModal({ open: false, label: '' })} 
        title="Κλειστά" 
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text>Είμαστε κλειστά την ημέρα {closedModal.label}.</Text>
          <Button 
            onClick={() => setClosedModal({ open: false, label: '' })}
            fullWidth
            color="pink"
          >
            Εντάξει
          </Button>
        </Stack>
      </Modal>
    </div>
  );
}
