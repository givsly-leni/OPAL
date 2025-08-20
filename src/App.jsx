import { MantineProvider, AppShell, Title, Container, Center, Button, Text } from '@mantine/core';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DayCalendar } from './components/DayCalendar';
import { ScheduleGrid } from './components/ScheduleGrid';
import { AppointmentForm } from './components/AppointmentForm';
import { InstallPrompt } from './components/InstallPrompt';
import { subscribeToAppointments } from './services/appointmentService';
import { getEmployees } from './services/employeeService';
import dayjs from 'dayjs';
import Customers from './components/Customers';
import Employees from './components/Employees';

function AppointmentPage({ appointments, setAppointments, employees }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateStr = searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : new Date();

  return (
    <Container size="lg" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      width: '100%', 
      maxWidth: '100vw',
      padding: '16px 12px',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        width: '100%', 
        maxWidth: '1200px',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <Button 
          variant="subtle" 
          size="sm" 
          onClick={() => navigate('/')}
          style={{ color: '#d52f74', fontWeight: 600 }}
        >
          ← Πίσω στο Ημερολόγιο
        </Button>
        <Text size="lg" fw={600} c="pink.7">
          {dayjs(date).format('dddd, DD MMM YYYY')}
        </Text>
      </div>
      
      <div style={{ 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'center',
        maxWidth: '1200px'
      }}>
  <ScheduleGrid date={date} appointments={appointments} setAppointments={setAppointments} employees={employees || []} />
      </div>
    </Container>
  );
}

function App() {
  const [appointments, setAppointments] = useState({});
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    // Appointments listener
    const unsubscribe = subscribeToAppointments((newAppointments) => {
      setAppointments(newAppointments);
    });
    // Employees fetch
    getEmployees().then(setEmployees);
    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <MantineProvider
        defaultColorScheme="light"
        withGlobalStyles
        withNormalizeCSS
        theme={{
          primaryColor: 'pink',
          colors: {
            brand: ['#fff5f7','#ffe0eb','#ffb3cd','#ff85b0','#f95592','#d52f74','#b5165d','#910b49','#6d0536','#470022'],
          },
          primaryShade: { light: 5, dark: 6 },
          fontFamily: 'Inter, system-ui, sans-serif',
          defaultRadius: 'md',
        }}
      >
        <AppShell
          padding="0"
          header={
            <div style={{ 
              padding: '16px 20px', 
              background: 'linear-gradient(90deg,#ff85b0,#d52f74)', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Title order={2} style={{ 
                color: 'white', 
                letterSpacing: 1,
                fontSize: 'clamp(20px, 4vw, 28px)'
              }}>
                Opal Appointments
              </Title>
              <div>
                <Button component="a" href="/customers" color="white" variant="filled" size="md" style={{ fontWeight: 700, color: '#d52f74', marginRight: 12 }}>
                  Πελάτισσες
                </Button>
                <Button component="a" href="/employees" color="white" variant="filled" size="md" style={{ fontWeight: 700, color: '#d52f74' }}>
                  Εργαζόμενοι
                </Button>
              </div>
            </div>
          }
          styles={{ 
            main: { 
              background: 'radial-gradient(circle at 50% 40%, #ffe0eb 0%, #fff5f7 60%, #ffffff 100%)', 
              minHeight: '100dvh', 
              display: 'flex', 
              alignItems: 'flex-start', 
              justifyContent: 'center', 
              padding: '24px 12px',
              boxSizing: 'border-box',
              overflowX: 'hidden'
            } 
          }}
        >
          <Routes>
            <Route path="/" element={
              <Center style={{ width: '100%', minHeight: 'calc(100vh - 120px)' }}>
                <DayCalendar />
              </Center>
            } />
            <Route path="/appointment" element={<AppointmentPage appointments={appointments} setAppointments={setAppointments} employees={employees} />} />
            <Route path="/appointment-form" element={<AppointmentForm appointments={appointments} setAppointments={setAppointments} employees={employees} />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/employees" element={<Employees refreshEmployees={async () => setEmployees(await getEmployees())} />} />
          </Routes>
          <InstallPrompt />
        </AppShell>
      </MantineProvider>
    </BrowserRouter>
  );
}

export default App;
