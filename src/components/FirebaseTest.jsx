import { useState } from 'react';
import { Button, Text, Stack, Alert } from '@mantine/core';
import { saveAppointment } from '../services/appointmentService';

export function FirebaseTest() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const testFirebaseConnection = async () => {
    setLoading(true);
    setStatus('Testing Firebase connection...');
    
    try {
      // Test saving a simple appointment
      const testAppointment = {
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        employee: 'Test Employee',
        clientName: 'Test Client',
        clientPhone: '1234567890',
        service: 'Test Service'
      };
      
  console.log('Testing Firebase connection (saving small test appointment)');
      const appointmentId = await saveAppointment(testAppointment);
      setStatus(`✅ Success! Test appointment saved with ID: ${appointmentId}`);
    } catch (error) {
      console.error('Firebase test failed:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing="md" style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
      <Text size="lg" fw={600}>Firebase Connection Test</Text>
      <Button onClick={testFirebaseConnection} loading={loading}>
        Test Firebase Connection
      </Button>
      {status && (
        <Alert color={status.includes('Success') ? 'green' : 'red'}>
          {status}
        </Alert>
      )}
    </Stack>
  );
}
