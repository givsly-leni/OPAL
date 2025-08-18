import { useState, useEffect } from 'react';
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
import { saveAppointment, deleteAppointment } from '../services/appointmentService';
import dayjs from 'dayjs';

const EMPLOYEES = [
  { id: 'aggelikh', name: 'Aggelikh' },
  { id: 'emmanouela', name: 'Emmanouela' },
  { id: 'hliana', name: 'Hliana' },
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

export function AppointmentForm({ appointments, setAppointments }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const dateStr = searchParams.get('date');
  const employeeId = searchParams.get('employee');
  const hour = searchParams.get('hour');
  const mode = searchParams.get('mode') || 'new';
  
  const date = dateStr ? new Date(dateStr) : new Date();
  const hours = generateHoursForDate(date);
  
  const [form, setForm] = useState({
    client: '',
    phone: '',
    description: '',
    durationSelect: '30',
    duration: 30
  });
  const [formError, setFormError] = useState('');

  const DURATION_OPTIONS = ["30", "45", "60", "90", "120", "custom"];

  const employee = EMPLOYEES.find(e => e.id === employeeId);

  // Load existing appointment data when in edit mode
  useEffect(() => {
    if (mode === 'edit' && appointments && dateStr && employeeId && hour) {
      const dateKey = dayjs(dateStr).format('YYYY-MM-DD');
      const dayAppointments = appointments[dateKey] || [];
      const existingAppointment = dayAppointments.find(apt => 
        apt.employee === employeeId && apt.time === hour
      );
      
      console.log('Loading edit data:', { dateKey, employeeId, hour, existingAppointment, appointments });
      
      if (existingAppointment) {
        const duration = existingAppointment.duration || 30;
        
        setForm({
          client: existingAppointment.client || '',
          phone: existingAppointment.phone || '',
          description: existingAppointment.description || '',
          durationSelect: '30',
          duration: duration
        });
      }
    }
  }, [mode, appointments, dateStr, employeeId, hour]);

  async function handleSave(e) {
    e.preventDefault();
    if (!form.client.trim()) {
      setFormError('Το όνομα είναι υποχρεωτικό');
      return;
    }
    
    const dateKey = dayjs(date).format('YYYY-MM-DD');
    const appointmentData = {
      date: dateKey,
      employee: employeeId,
      time: hour,
      client: form.client.trim(),
      phone: form.phone.trim(),
      duration: parseInt(form.duration, 10) || 30,
      description: form.description.trim()
    };

    try {
      // Save to Firebase
      await saveAppointment(appointmentData);
      console.log('Appointment saved to Firebase:', appointmentData);
      
      // Navigate back to the schedule
      navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`);
    } catch (error) {
      console.error('Error saving appointment:', error);
      setFormError('Σφάλμα κατά την αποθήκευση. Δοκιμάστε ξανά.');
    }
  }

  function handleDeleteConfirmation() {
    alert('Delete button clicked');
    console.log('Delete button clicked');
    const confirmMessage = `Είστε σίγουροι ότι θέλετε να διαγράψετε το ραντεβού της "${form.client}" στις ${hour}?\n\nΑυτή η ενέργεια δεν μπορεί να αναιρεθεί.`;
    
    if (confirm(confirmMessage)) {
      console.log('User confirmed deletion');
      handleDelete();
    } else {
      console.log('User cancelled deletion');
    }
  }

  async function handleDelete() {
    const dateKey = dayjs(date).format('YYYY-MM-DD');
    
    try {
      // Find the appointment ID in Firebase
      const currentAppointments = appointments[dateKey] || [];
      const appointmentToDelete = currentAppointments.find(apt => 
        apt.employee === employeeId && apt.time === hour
      );
      
      if (appointmentToDelete && appointmentToDelete.id) {
        await deleteAppointment(appointmentToDelete.id);
        console.log('Appointment deleted from Firebase:', appointmentToDelete.id);
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

  if (!employeeId || !hour) {
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
    <Container size="sm" py="md">
      <Paper 
        p="md" 
        radius="lg" 
        withBorder 
        shadow="lg"
        style={{
          background: 'linear-gradient(135deg, #ffffff, #fff8fc)',
          border: '1px solid rgba(214, 51, 108, 0.25)'
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
            
            <Title 
              order={2} 
              ta="center" 
              c="pink.7" 
              mb="xs"
              style={{ fontSize: 'clamp(18px, 3.5vw, 24px)' }}
            >
              {mode === 'edit' ? 'Επεξεργασία' : 'Νέο'} Ραντεβού
            </Title>
            
            <Text ta="center" c="dimmed" size="lg" fw={500}>
              {employee?.name} • {hour}
            </Text>
            <Text ta="center" c="dimmed" size="sm">
              {dayjs(date).format('dddd, DD MMM YYYY')}
            </Text>
          </div>

          <Divider />

          {/* Form */}
          <form onSubmit={handleSave}>
            <Stack gap="md">
              <TextInput
                label="Όνομα Πελάτισσας"
                placeholder="Εισάγετε το όνομα"
                value={form.client}
                onChange={(e) => setForm(f => ({ ...f, client: e.target.value }))}
                required
                size="md"
                styles={{
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6 },
                  input: { fontSize: 14, padding: '10px 12px' }
                }}
              />

              <TextInput
                label="Τηλέφωνο"
                placeholder="69XXXXXXXX"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9+ ]/g, '') }))}
                size="md"
                styles={{
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6 },
                  input: { fontSize: 14, padding: '10px 12px' }
                }}
              />

              <TextInput
                label="Διαρκεια"
                placeholder="Εισάγετε τη διάρκεια"
                value={form.duration}
                onChange={(e) => setForm(f => ({ ...f, duration: e.target.value.replace(/[^0-9+ ]/g, '') }))}
                size="md"
                styles={{
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6 },
                  input: { fontSize: 14, padding: '10px 12px' }
                }}
              />

              
              <Textarea
                label="Περιγραφή / Σημειώσεις"
                placeholder="Προαιρετικές σημειώσεις..."
                autosize
                minRows={2}
                maxRows={4}
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                styles={{
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6 },
                  input: {
                    background: '#fff',
                    border: '1px solid rgba(214,51,108,0.35)',
                    fontSize: 14,
                    borderRadius: 8,
                    padding: '10px 12px'
                  }
                }}
              />

              {formError && (
                <Text size="sm" c="red.7" fw={500} ta="center">
                  {formError}
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
                
                {mode === 'edit' && (
                  <Button
                    variant="light"
                    color="red"
                    size="md"
                    onClick={handleDeleteConfirmation}
                    style={{ flex: 1 }}
                  >
                    Διαγραφή
                  </Button>
                )}
                
                <Button
                  type="submit"
                  size="md"
                  color="pink"
                  variant={form.client.trim() && !formError ? 'filled' : 'light'}
                  disabled={!form.client.trim() || !!formError}
                  style={{ flex: mode === 'edit' ? 1 : 2 }}
                >
                  {mode === 'edit' ? 'Ενημέρωση' : 'Αποθήκευση'} Ραντεβού
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
