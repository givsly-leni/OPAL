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
import { getCustomerByPhone, saveCustomer, searchCustomersByPhonePrefix } from '../services/customerService';
import dayjs from 'dayjs';

const EMPLOYEES = [
  { id: 'aggelikh', name: 'Αγγελικη' },
  { id: 'emmanouela', name: 'Εμμανουελα' },
  { id: 'hliana', name: 'Ηλιανα' },
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
    setForm({
      id: undefined,
      client: cust.name || '',
      phone: cust.phone || '',
      description: cust.notes || '',
      clientInfo: cust.clientInfo || cust.info || '',
      durationSelect: '30',
      duration: typeof form.duration === 'number' ? form.duration : 30
    });
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
          <form onSubmit={handleSave} style={{ width: '100%' }}>
            <Stack gap="md" align="center" style={{ textAlign: 'center' }}>
        <TextInput
                label="Όνομα Πελάτισσας"
                placeholder="Εισάγετε το όνομα"
                value={form.client}
                onChange={(e) => setForm(f => ({ ...f, client: e.target.value }))}
                required
                size="md"
                styles={{
          root: { width: '100%' },
          label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
          input: { fontSize: 14, padding: '10px 12px', textAlign: 'center' }
                }}
              />

              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
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
                  description={customerLookupLoading ? 'Αναζήτηση πελάτη/σας...' : (customerLoaded ? 'Βρέθηκαν στοιχεία πελάτη/σας' : undefined)}
                  size="md"
                  styles={{
                    root: { width: '100%', maxWidth: 360, margin: '0 auto' },
                    label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                    input: { fontSize: 14, padding: '10px 12px', textAlign: 'center' }
                  }}
                />
                {showSuggestions && customerSuggestions.length > 0 && (
                  <Paper
                    withBorder
                    shadow="md"
                    radius="md"
                    p={4}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      maxWidth: 360,
                      zIndex: 30,
                      marginTop: 4,
                      maxHeight: 180,
                      overflowY: 'auto',
                      background: '#fff',
                      border: '2px solid #e86aa6',
                      boxShadow: '0 6px 18px -4px rgba(214,51,108,0.35)'
                    }}
                  >
                    <Stack gap={4} style={{ width: '100%' }}>
                      {customerSuggestions.map(cust => (
                        <Button
                          key={cust.id}
                          variant="subtle"
                          size="compact-sm"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(cust); }}
                          styles={{ root: { justifyContent: 'flex-start', width: '100%', padding: '6px 8px' } }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
                            <span style={{ fontWeight: 600 }}>{cust.name || '—'}</span>
                            <span style={{ color: '#888', fontSize: 11 }}>{cust.phone}</span>
                          </div>
                        </Button>
                      ))}
                    </Stack>
                  </Paper>
                )}
              </div>

        <NumberInput
                label="Διάρκεια (λεπτά)"
                placeholder="π.χ. 30"
                value={form.duration === '' ? '' : form.duration}
                onChange={(val) => {
                  setForm(f => ({ ...f, duration: val === '' ? '' : val }));
                }}
                min={5}
                max={480}
                step={5}
                clampBehavior="blur" /* allow temporary out-of-range / empty while typing */
                inputMode="numeric"
                allowDecimal={false}
                hideControls
                size="md"
                styles={{
          root: { width: '100%' },
          label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
          input: { fontSize: 14, padding: '10px 12px', textAlign: 'center' }
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
                  root: { width: '100%' },
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                  input: {
                    background: '#fff',
                    border: '1px solid rgba(214,51,108,0.35)',
                    fontSize: 14,
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'center'
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
                  root: { width: '100%' },
                  label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'center', width: '100%' },
                  input: {
                    background: '#fff',
                    border: '1px solid rgba(214,51,108,0.35)',
                    fontSize: 14,
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'center'
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
                
                
                
                <Button
                  type="submit"
                  size="md"
                  // Force strong visible styling (some iPhones rendered the default as near-white)
                  variant="filled"
                  disabled={!form.client.trim() || !!formError}
                  style={{
                    flex: mode === 'edit' ? 1 : 2,
                    background: (!form.client.trim() || !!formError) ? '#fbe0eb' : '#d6336c',
                    color: (!form.client.trim() || !!formError) ? '#c2255c' : '#ffffff',
                    border: '1px solid #d6336c',
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    boxShadow: (!form.client.trim() || !!formError) ? 'none' : '0 3px 8px -3px rgba(214,51,108,0.55)',
                    transition: 'background-color 160ms ease, box-shadow 160ms ease'
                  }}
                  styles={{
                    root: {
                      '&:hover': (!form.client.trim() || !!formError)
                        ? { background: '#f7d1de' }
                        : { background: '#c2255c' }
                    }
                  }}
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
