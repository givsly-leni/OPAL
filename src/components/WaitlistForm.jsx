import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Paper, Stack, Title, TextInput, Textarea, Button, Text, Box } from '@mantine/core';
import dayjs from 'dayjs';
import { addWaiting, suggestCustomersByName, suggestCustomersByPhone, getWaitingById, updateWaiting } from '../services/waitlistService';

export function WaitlistForm(){
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateStr = searchParams.get('date') || dayjs().format('YYYY-MM-DD');
  const [form, setForm] = React.useState({ name:'', phone:'', prefs:'' });
  const [error, setError] = React.useState('');
  const [nameSuggestions, setNameSuggestions] = React.useState([]);
  const [phoneSuggestions, setPhoneSuggestions] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const wrapperRef = React.useRef(null);

  function handleSave(){
    if(!form.name.trim() || !form.phone.trim()){
      setError('Όνομα και τηλέφωνο απαιτούνται');
      return;
    }
    setSaving(true);
    (async ()=>{
      try{
        if(editingId){
          await updateWaiting(editingId, { name: form.name, phone: form.phone, prefs: form.prefs });
        } else {
          await addWaiting(dateStr, form);
        }
        navigate(-1);
      }catch(e){
        console.error('Failed saving waitlist', e);
        setError('Σφάλμα αποθήκευσης. Προσπαθήστε ξανά.');
      }finally{ setSaving(false); }
    })();
  }

  async function onNameChange(v){
    setForm(f=>({ ...f, name: v }));
    if((v||'').trim().length >= 2){
      const res = await suggestCustomersByName(v, 6);
      setNameSuggestions(res || []);
    }else{
      setNameSuggestions([]);
    }
  }

  async function onPhoneChange(v){
    const digits = (v||'').replace(/\D/g,'');
    setForm(f=>({ ...f, phone: digits }));
    if(digits.length >= 3){
      const res = await suggestCustomersByPhone(digits, 6);
      setPhoneSuggestions(res || []);
    }else{
      setPhoneSuggestions([]);
    }
  }

  // If id query param present, load the waiting and prefill
  React.useEffect(()=>{
    const id = searchParams.get('id');
    if(!id) return;
    (async ()=>{
      const rec = await getWaitingById(id);
      if(rec){ setEditingId(id); setForm({ name: rec.name||'', phone: rec.phone||'', prefs: rec.prefs||'' }); }
    })();
  }, [searchParams]);

  // Close suggestion panels when clicking outside the form — use capture to catch early
  React.useEffect(()=>{
    function handleDocClick(e){
      if(!wrapperRef.current) return;
      if(!wrapperRef.current.contains(e.target)){
        setNameSuggestions([]);
        setPhoneSuggestions([]);
      }
    }
    document.addEventListener('pointerdown', handleDocClick, true);
  function handleEsc(e){ if(e.key === 'Escape'){ setNameSuggestions([]); setPhoneSuggestions([]); } }
  document.addEventListener('keydown', handleEsc);
  return () => { document.removeEventListener('pointerdown', handleDocClick, true); document.removeEventListener('keydown', handleEsc); };
  },[]);

  return (
    <div style={{ display:'flex', justifyContent:'center', padding:24 }}>
      <Paper ref={wrapperRef} withBorder shadow="lg" radius="md" p="md" style={{ width: 'min(680px, 96%)' }}>
        <Stack gap="md">
          <Title order={3} style={{ margin:0 }}>{`Προσθήκη Αναμονής — ${dayjs(dateStr).format('dddd, DD MMM YYYY')}`}</Title>
          <Box style={{ position: 'relative' }}>
            <TextInput
              label="Όνομα"
              value={form.name}
              onChange={e=>onNameChange(e.target.value)}
              onBlur={() => { setTimeout(()=> setNameSuggestions([]), 120); }}
              size="md"
              styles={{
                root: { width: '100%' },
                label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'left' },
                input: { fontSize: 14, padding: '8px 10px' }
              }}
            />
            {nameSuggestions.length > 0 && (
              <Paper
                withBorder
                shadow="md"
                radius="md"
                p={4}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 40,
                  marginTop: 6,
                  maxHeight: 220,
                  overflowY: 'auto',
                  background: '#fff',
                  border: '2px solid #e86aa6',
                  boxShadow: '0 6px 18px -4px rgba(214,51,108,0.35)'
                }}
              >
                <Stack gap={4} style={{ width: '100%' }}>
                  {nameSuggestions.map(s => (
                    <Button
                      key={s.id}
                      variant="subtle"
                      size="compact-sm"
                      onMouseDown={(e)=>{ e.preventDefault(); setForm(f=>({ ...f, name: s.name || '', phone: s.phone || '' })); setNameSuggestions([]); setPhoneSuggestions([]); }}
                      styles={{ root: { justifyContent: 'flex-start', width: '100%', padding: '6px 8px' } }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700 }}>{s.name || '—'}</span>
                        <span style={{ color: '#888', fontSize: 11 }}>{s.phone}</span>
                      </div>
                    </Button>
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>

          <Box style={{ position: 'relative' }}>
            <TextInput
              label="Τηλέφωνο"
              value={form.phone}
              onChange={e=>onPhoneChange(e.target.value)}
              onBlur={() => { setTimeout(()=> setPhoneSuggestions([]), 120); }}
              size="md"
              inputMode="tel"
              styles={{
                root: { width: '100%' },
                label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'left' },
                input: { fontSize: 14, padding: '8px 10px' }
              }}
            />
            {phoneSuggestions.length > 0 && (
              <Paper
                withBorder
                shadow="md"
                radius="md"
                p={4}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 40,
                  marginTop: 6,
                  maxHeight: 220,
                  overflowY: 'auto',
                  background: '#fff',
                  border: '2px solid #e86aa6',
                  boxShadow: '0 6px 18px -4px rgba(214,51,108,0.35)'
                }}
              >
                <Stack gap={4} style={{ width: '100%' }}>
                  {phoneSuggestions.map(s => (
                    <Button
                      key={s.id}
                      variant="subtle"
                      size="compact-sm"
                      onMouseDown={(e)=>{ e.preventDefault(); setForm(f=>({ ...f, name: s.name || '', phone: s.phone || '' })); setNameSuggestions([]); setPhoneSuggestions([]); }}
                      styles={{ root: { justifyContent: 'flex-start', width: '100%', padding: '6px 8px' } }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700 }}>{s.name || '—'}</span>
                        <span style={{ color: '#888', fontSize: 11 }}>{s.phone}</span>
                      </div>
                    </Button>
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>
          <Textarea
            label="Προτιμήσεις"
            value={form.prefs}
            onChange={e=>setForm(f=>({ ...f, prefs: e.target.value }))}
            minRows={3}
            styles={{
              root: { width: '100%' },
              label: { fontSize: 14, fontWeight: 600, color: '#c2255c', marginBottom: 6, textAlign: 'left' },
              input: { background: '#fff', border: '1px solid rgba(214,51,108,0.18)', fontSize: 14, borderRadius: 8 }
            }}
          />
          {error ? <div style={{ color:'#c2255c', fontWeight:700 }}>{error}</div> : null}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Button variant="outline" onClick={() => navigate(-1)}>Άκυρο</Button>
            <Button color="pink" onClick={handleSave} loading={saving} disabled={saving}>Αποθήκευση</Button>
          </div>
        </Stack>
      </Paper>
    </div>
  );
}

export default WaitlistForm;
