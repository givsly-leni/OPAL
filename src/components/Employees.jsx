import React, { useEffect, useState } from 'react';
import { getEmployees, saveEmployee, deleteEmployee } from '../services/employeeService';
import { Button, TextInput, Table, Modal, Group, Paper, Select, NumberInput } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function Employees({ refreshEmployees }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editEmployee, setEditEmployee] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', schedule: {} });
  const navigate = useNavigate();

  useEffect(() => {
    function parseRange(r) {
      if (Array.isArray(r)) return r;
      if (typeof r === 'string' && r.includes('-')) {
        const [start, end] = r.split('-');
        return [parseInt(start, 10), parseInt(end, 10)];
      }
      return [9, 17];
    }
    async function fetchEmployees() {
      setLoading(true);
      const data = await getEmployees();
      // Parse all schedule strings to arrays for every employee
      const fixed = data.map(emp => {
        const fixedSchedule = {};
        Object.entries(emp.schedule || {}).forEach(([day, arr]) => {
          fixedSchedule[day] = (arr || []).map(parseRange);
        });
        return { ...emp, schedule: fixedSchedule };
      });
      setEmployees(fixed);
      setLoading(false);
    }
    fetchEmployees();
  }, []);

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.id?.toLowerCase().includes(search.toLowerCase())
  );

  function parseRange(r) {
    if (Array.isArray(r)) return r;
    if (typeof r === 'string' && r.includes('-')) {
      const [start, end] = r.split('-');
      // Only use hour part (e.g., '10:00' → 10)
      return [parseInt(start, 10), parseInt(end, 10)];
    }
    return [9, 17]; // fallback
  }

  function openEdit(emp) {
    // Convert all string ranges to number arrays for UI
    const fixedSchedule = {};
    Object.entries(emp.schedule || {}).forEach(([day, arr]) => {
      fixedSchedule[day] = (arr || []).map(parseRange);
    });
    setEditEmployee(emp);
    setForm({ id: emp.id, name: emp.name, schedule: fixedSchedule });
    setModalOpen(true);
  }

  async function saveEdit() {
    await saveEmployee(form);
    if (refreshEmployees) await refreshEmployees();
    setModalOpen(false);
  }

  return (
    <Paper shadow="md" radius="lg" p={24} style={{ maxWidth: 900, margin: '32px auto', background: 'rgba(255,255,255,0.96)', border: '1px solid #ffe0eb' }}>
      <Group mb="md" justify="space-between" align="center">
        <h2 style={{ color: '#d52f74', fontWeight: 700, letterSpacing: 1, margin: 0 }}>Εργαζόμενοι</h2>
        <Button color="pink" variant="light" onClick={() => navigate('/')}>Πίσω στο Ημερολόγιο</Button>
      </Group>
      <Group mb="md">
        <TextInput
          placeholder="Αναζήτηση ονόματος ή id"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button color="pink" variant="filled" onClick={() => {
          setForm({ id: '', name: '', schedule: {} });
          setEditEmployee(null);
          setModalOpen(true);
        }}>+ Προσθήκη Εργαζόμενου</Button>
      </Group>
      <Table striped highlightOnHover withBorder withColumnBorders style={{ background: 'white', borderRadius: 12, overflow: 'hidden', fontSize: 15 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Όνομα</th>
            <th>Επεξεργασία</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={3} style={{ textAlign: 'center', color: '#aaa' }}>Δεν βρέθηκαν εργαζόμενοι.</td></tr>
          ) : filtered.map(e => (
            <tr key={e.id || e.name || Math.random()}>
              <td>{e.id || <span style={{ color: '#aaa' }}>—</span>}</td>
              <td>{e.name || <span style={{ color: '#aaa' }}>—</span>}</td>
              <td>
                <Button size="xs" onClick={() => openEdit(e)}>Επεξεργασία</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editEmployee ? "Επεξεργασία Εργαζόμενου" : "Προσθήκη Εργαζόμενου"} closeButtonProps={{ style: { display: 'none' } }}
        styles={{ body: { maxHeight: 420, overflowY: 'auto', paddingRight: 8 } }}>
        <TextInput
          label="ID"
          value={form.id}
          onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
          mb="sm"
          disabled
        />
        <TextInput
          label="Όνομα"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          mb="sm"
        />
        <div style={{ margin: '16px 0' }}>
          <b>Ωράριο ανά ημέρα:</b>
          {[
            { label: 'Κυριακή', key: '0', closed: true },
            { label: 'Δευτέρα', key: '1', closed: true },
            { label: 'Τρίτη', key: '2' },
            { label: 'Τετάρτη', key: '3' },
            { label: 'Πέμπτη', key: '4' },
            { label: 'Παρασκευή', key: '5' },
            { label: 'Σάββατο', key: '6' },
          ].map(({ label, key: dayKey, closed: isClosed }) => {
            const ranges = isClosed ? [] : (form.schedule?.[dayKey] || []);
            return (
              <div key={dayKey} style={{ margin: '8px 0', padding: 8, background: '#f9f2f7', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                {isClosed ? (
                  <div style={{ color: '#aaa', fontSize: 13 }}>Κλειστά</div>
                ) : (
                  <>
                    {ranges.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>Δεν έχει οριστεί ωράριο</div>}
                    {ranges.map((r, i) => (
                      <Group key={i} mb={4}>
                        <NumberInput
                          label="Από"
                          min={0}
                          max={23}
                          step={1}
                          hideControls
                          value={r[0]}
                          onChange={val => {
                            const newRanges = ranges.map((rr,ii)=>ii===i?[val,rr[1]]:rr);
                            setForm(f => ({ ...f, schedule: { ...f.schedule, [dayKey]: newRanges } }));
                          }}
                          style={{ width: 70 }}
                        />
                        <NumberInput
                          label="Έως"
                          min={0}
                          max={23}
                          step={1}
                          hideControls
                          value={r[1]}
                          onChange={val => {
                            const newRanges = ranges.map((rr,ii)=>ii===i?[rr[0],val]:rr);
                            setForm(f => ({ ...f, schedule: { ...f.schedule, [dayKey]: newRanges } }));
                          }}
                          style={{ width: 70 }}
                        />
                        <Button size="xs" color="red" variant="subtle" onClick={() => {
                          const newRanges = ranges.filter((_,ii)=>ii!==i);
                          setForm(f => ({ ...f, schedule: { ...f.schedule, [dayKey]: newRanges } }));
                        }}>Διαγραφή</Button>
                      </Group>
                    ))}
                    <Button size="xs" color="pink" variant="light" mt={4} onClick={() => {
                      setForm(f => {
                        const current = f.schedule?.[dayKey] || [];
                        const defaultRange = [9, 17];
                        return { ...f, schedule: { ...f.schedule, [dayKey]: [...current, defaultRange] } };
                      });
                    }}>+ Προσθήκη ωραρίου</Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <Group mt="md">
          <Button onClick={saveEdit}>Αποθήκευση</Button>
          <Button variant="outline" onClick={() => setModalOpen(false)}>Άκυρο</Button>
        </Group>
      </Modal>
    </Paper>
  );
}
