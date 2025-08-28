#!/usr/bin/env node
// Small helper to purge old appointments. Usage:
// node scripts/purge_old_appointments.js [YYYY-MM-DD]

import('../src/services/appointmentService.js').then(mod => {
  const { findAppointmentsBefore, purgeAppointmentsBefore } = mod;
  return (async () => {
    const args = process.argv.slice(2);
    const run = args.includes('--run');
    const dateArgIdx = args.findIndex(a => a === '--date');
    const date = dateArgIdx !== -1 && args[dateArgIdx+1] ? args[dateArgIdx+1] : undefined;
    try {
      const matched = await findAppointmentsBefore(date);
      console.log(`Found ${matched.length} appointments with date < ${date || '(today)'}:`);
      if (matched.length > 0) console.table(matched.slice(0, 50));
      if (!run) {
        console.log('\nDry-run mode. To delete these appointments run:');
        console.log(`node ./scripts/purge_old_appointments.js --date ${date || ''} --run`);
        process.exit(0);
      }
      const res = await purgeAppointmentsBefore(date, false);
      console.log('Purge result:', res);
      process.exit(0);
    } catch (e) {
      console.error('Purge failed:', e);
      process.exit(2);
    }
  })();
}).catch(err => { console.error('Failed to load module:', err); process.exit(2); });
