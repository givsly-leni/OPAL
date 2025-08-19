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
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                pattern="[0-9 +]*"
import { getCustomerByPhone, saveCustomer, searchCustomersByPhonePrefix } from '../services/customerService';
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
    id: undefined, // existing appointment id when editing
    client: '',
    phone: '',
    description: '',
  clientInfo: '', // persistent client information (preferences, notes)
    durationSelect: '30',
    duration: 30
  });
  const [formError, setFormError] = useState('');
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phoneQuery, setPhoneQuery] = useState('');

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
      id: existingAppointment.id,
          client: existingAppointment.client || '',
          phone: existingAppointment.phone || '',
          description: existingAppointment.description || '',
          clientInfo: existingAppointment.clientInfo || existingAppointment.customerInfo || '',
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
      id: form.id, // will trigger update when present
      date: dateKey,
      employee: employeeId,
      time: hour,
      client: form.client.trim(),
      phone: form.phone.trim(),
      duration: parseInt(form.duration, 10) || 30,
      description: form.description.trim()
  ,clientInfo: form.clientInfo.trim()
    };

    try {
      // Save to Firebase
      await saveAppointment(appointmentData);
      console.log('Appointment saved to Firebase:', appointmentData);

      // Upsert customer profile (fire and forget intentionally after appointment save)
      if (form.phone.trim()) {
        saveCustomer({
          phone: form.phone.trim(),
            name: form.client.trim(),
            client: form.client.trim(),
            description: form.description.trim(),
            clientInfo: form.clientInfo.trim(),
            lastAppointmentAt: new Date().toISOString()
        }).catch(err => console.warn('Customer save error (non-blocking):', err));
      }
      
      // Navigate back to the schedule
      navigate(`/appointment?date=${dayjs(date).format('YYYY-MM-DD')}`);
    } catch (error) {
      console.error('Error saving appointment:', error);
      setFormError('Σφάλμα κατά την αποθήκευση. Δοκιμάστε ξανά.');
    }
  }

  async function handlePhoneBlur() {
    const phone = form.phone.trim();
    if (!phone) return;
    setCustomerLookupLoading(true);
    setCustomerLoaded(false);
    try {
      const customer = await getCustomerByPhone(phone);
      if (customer) {
        setForm(f => ({
          ...f,
          client: f.client || customer.name || '',
          description: f.description || customer.notes || ''
        }));
        setCustomerLoaded(true);
      }
    } catch (err) {
      console.warn('Customer lookup failed', err);
    } finally {
      setCustomerLookupLoading(false);
    }
  }

  // Live phone input change handler with debounced search
  useEffect(() => {
    if (!phoneQuery || phoneQuery.replace(/[^0-9]/g, '').length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const results = await searchCustomersByPhonePrefix(phoneQuery, 6);
      if (active) {
        setCustomerSuggestions(results);
        setShowSuggestions(true);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [phoneQuery]);

  function handleSelectSuggestion(cust) {
    setForm(f => ({
      ...f,
      phone: cust.phone,
      client: cust.name || f.client,
  description: f.description || cust.notes || '',
  clientInfo: f.clientInfo || cust.clientInfo || cust.info || ''
    }));
    setCustomerLoaded(true);
    setShowSuggestions(false);
  }

  function handleDeleteConfirmation() {
    alert('Delete button clicked');
    console.log('Delete button clicked');
    const confirmMessage = `Είστε σίγουροι ότι θέλετε να διαγράψετε το ραντεβού του/της "${form.client}" στις ${hour}?\n\nΑυτή η ενέργεια δεν μπορεί να αναιρεθεί.`;
    
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
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9+ ]/g, '');
                  setForm(f => ({ ...f, phone: val }));
                  setPhoneQuery(val);
                  setShowSuggestions(true);
                }}
                onBlur={handlePhoneBlur}
                description={customerLookupLoading ? 'Αναζήτηση πελάτη/σας...' : (customerLoaded ? 'Βρέθηκαν στοιχεία πελάτισσας' : undefined)}
                size="md"
                styles={{
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6 },
                  input: { fontSize: 14, padding: '10px 12px' }
                }}
              />
              {showSuggestions && customerSuggestions.length > 0 && (
                <Paper withBorder shadow="sm" p={4} radius="md" style={{ marginTop: -8 }}>
                  <Stack gap={2}>
                    {customerSuggestions.map(cust => (
                      <Button
                        key={cust.id}
                        variant="subtle"
                        size="compact-sm"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(cust); }}
                        styles={{ root: { justifyContent: 'flex-start' } }}
                      >
                        <span style={{ fontWeight: 600, marginRight: 8 }}>{cust.name || '—'}</span>
                        <span style={{ color: '#888', fontSize: 12 }}>{cust.phone}</span>
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              )}

              <NumberInput
                label="Διάρκεια (λεπτά)"
                placeholder="π.χ. 30"
                value={Number(form.duration) || 0}
                onChange={(val) => setForm(f => ({ ...f, duration: val || 0 }))}
                min={5}
                max={480}
                step={5}
                clampBehavior="strict"
                inputMode="numeric"
                allowDecimal={false}
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

              <Textarea
                label="Σταθερές Πληροφορίες Πελάτισσας"
                placeholder="Προτιμήσεις, αλλεργίες, ιστορικό... (αποθηκεύονται για μελλοντικά ραντεβού)"
                autosize
                minRows={2}
                maxRows={6}
                value={form.clientInfo}
                onChange={(e) => setForm(f => ({ ...f, clientInfo: e.target.value }))}
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
