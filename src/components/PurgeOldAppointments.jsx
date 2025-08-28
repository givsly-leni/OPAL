import React, { useEffect, useState } from 'react';
import { Container, Paper, Title, Text, Button, Group, TextInput, Table, Center } from '@mantine/core';
import dayjs from 'dayjs';
import { findAppointmentsBefore, purgeAppointmentsBefore } from '../services/appointmentService';

export default function PurgeOldAppointments(){
  const [dateCutoff, setDateCutoff] = useState(dayjs().format('YYYY-MM-DD'));
  const [matched, setMatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  async function preview(){
    setMessage('');
    setLoading(true);
    try{
      const list = await findAppointmentsBefore(dateCutoff);
      setMatched(list || []);
    }catch(err){
      console.error('Preview failed', err);
      setMessage('Preview failed: ' + (err?.message || String(err)));
    }finally{ setLoading(false); }
  }

  async function runPurge(){
    if(!confirm(`Delete ${matched.length} appointments dated before ${dateCutoff}? This cannot be undone.`)) return;
    setRunning(true);
    setMessage('');
    try{
      const res = await purgeAppointmentsBefore(dateCutoff, false);
      setMessage(`Deleted ${res.deletedCount || 0} appointments.`);
      // refresh preview
      await preview();
    }catch(err){
      console.error('Purge failed', err);
      setMessage('Purge failed: ' + (err?.message || String(err)));
    }finally{ setRunning(false); }
  }

  useEffect(()=>{ preview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <Container size="md" py="md">
      <Paper p="md" radius="md" withBorder shadow="sm">
        <Title order={3} style={{ marginBottom: 8 }}>Admin: Purge old appointments</Title>
        <Text size="sm" color="dimmed" style={{ marginBottom: 12 }}>
          This tool lists appointments with date strictly less than the chosen cutoff.
          By default the cutoff is today so only previous days are matched.
        </Text>

        <Group align="center" style={{ marginBottom: 12 }}>
          <TextInput label="Cutoff date (YYYY-MM-DD)" value={dateCutoff} onChange={(e)=>setDateCutoff(e.target.value)} />
          <Button onClick={preview} loading={loading}>Preview</Button>
          <Button color="red" onClick={runPurge} loading={running} disabled={matched.length===0}>Delete matched</Button>
        </Group>

        {message && <Text size="sm" color="red" style={{ marginBottom: 8 }}>{message}</Text>}

        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {matched.length === 0 ? (
            <Center style={{ padding: 24 }}><Text color="dimmed">No matched appointments</Text></Center>
          ) : (
            <Table striped highlightOnHover>
              <thead>
                <tr><th>Date</th><th>Time</th><th>Employee</th><th>Client</th></tr>
              </thead>
              <tbody>
                {matched.map(m => (
                  <tr key={m.id}><td>{m.date}</td><td>{m.time || '-'}</td><td>{m.employee || '-'}</td><td>{m.client || '-'}</td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Paper>
    </Container>
  );
}
