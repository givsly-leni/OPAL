import React, { useEffect, useState } from 'react';
import { getDocs, collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { Button, TextInput, Table, Modal, Group, Paper } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editCustomer, setEditCustomer] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', clientInfo: '' }); // clientInfo = Σταθερές Πληροφορίες Πελάτισσας

  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true);
      const snap = await getDocs(collection(db, 'customers'));
      setCustomers(snap.docs.map(d => d.data()));
      setLoading(false);
    }
    fetchCustomers();
  }, []);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  function openEdit(cust) {
  console.log(`Editing customer id=${cust.id} name=${cust.name}`);
    setEditCustomer(cust);
    setForm({ name: cust.name || '', phone: cust.phone || '', clientInfo: cust.clientInfo || '' });
    setModalOpen(true);
  }

  async function saveEdit() {
    const key = editCustomer.id || editCustomer.phoneKey || editCustomer.phone;
  await setDoc(doc(db, 'customers', key), { ...editCustomer, ...form }, { merge: true });
  setCustomers(cs => cs.map(c => (c.id === key ? { ...c, ...form } : c)));
    setModalOpen(false);
  }

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fff0f6 0%, #f8f9fa 100%)',
      margin: 0,
      padding: 0
    }}>
      <Paper
        shadow="lg"
        radius="xl"
        p={32}
        withBorder
        style={{
          width: '100%',
          maxWidth: '900px',
          minHeight: '600px',
          margin: '40px auto',
          background: 'rgba(255,255,255,0.97)',
          border: '1px solid #ffe0eb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          boxShadow: '0 8px 32px -8px rgba(214,51,108,0.10)'
        }}
      >
      <Group mb="md" justify="space-between" align="center">
        <h2 style={{ color: '#d52f74', fontWeight: 700, letterSpacing: 1, margin: 0 }}>Πελάτισσες</h2>
        <Button color="pink" variant="light" onClick={() => navigate('/')} style={{ fontWeight: 600 }}>
          Πίσω στο Ημερολόγιο
        </Button>
      </Group>
      <Group mb="md">
        <TextInput
          placeholder="Search by name or phone"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </Group>
  <Table striped highlightOnHover withBorder withColumnBorders style={{ background: 'white', borderRadius: 12, overflow: 'hidden', fontSize: 15 }}>
        <thead>
          <tr>
            <th>Όνομα</th>
            <th>Τηλέφωνο</th>
            <th>Πληροφορίες </th>
            <th>Επεξεργασία</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id || c.phone}>
              <td>{c.name}</td>
              <td>{c.phone}</td>
              <td>{c.clientInfo}</td>
              <td>
                <Button size="xs" onClick={() => openEdit(c)}>Επεξεργασία</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
  <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Επεξεργασία Πελάτισσας" closeButtonProps={{ style: { display: 'none' } }}>
        <TextInput
          label="Όνομα"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          mb="sm"
        />
        <TextInput
          label="Τηλέφωνο"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          mb="sm"
        />
        <TextInput
          label="Σταθερές Πληροφορίες Πελάτισσας"
          value={form.clientInfo}
          onChange={e => setForm(f => ({ ...f, clientInfo: e.target.value }))}
          mb="sm"
        />
        <Group mt="md">
          <Button onClick={saveEdit}>Αποθήκευση</Button>
          <Button variant="outline" onClick={() => setModalOpen(false)}>Άκυρο</Button>
        </Group>
      </Modal>
    </Paper>
  </div>
  );
}
