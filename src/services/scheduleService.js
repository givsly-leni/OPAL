import dayjs from 'dayjs';

// Default per-employee schedules (legacy fallback)
export const EMPLOYEE_SCHEDULE = {
  aggelikh: {
    2: [['10:00','16:00'], ['19:00','21:00']],
    3: [['13:00','21:00']],
    4: [['10:00','16:00'], ['19:00','21:00']],
    5: [['13:00','21:00']],
  },
  emmanouela: {
    2: [['13:00','21:00']],
    3: [['13:00','21:00']],
    4: [['13:00','21:00']],
    5: [['09:00','17:00']],
    6: [['09:00','15:00']],
  },
  hliana: {
    2: [['13:00','21:00']],
    3: [['10:00','18:00']],
    4: [['13:00','21:00']],
    5: [['13:00','21:00']],
    6: [['09:00','15:00']],
  },
  kelly: {
    3: [['17:00','21:00']],
    4: [['17:00','21:00']],
    5: [['17:00','21:00']],
    6: [['10:00','15:00']],
  }
};

// Effective-dated schedule history. Each entry has { effective: 'YYYY-MM-DD', ranges: { weekday: [ [start,end], ... ] } }
// New schedule for emmanouela starting 2025-09-06
export const EMPLOYEE_SCHEDULE_HISTORY = {
  emmanouela: [
    {
      effective: '2025-09-06',
      ranges: {
        // 0=Sun ... 6=Sat
        2: null, // Tuesday: no work
        3: [['16:00','21:00']], // Wednesday 16-21
        4: [['13:00','21:00']], // Thursday 13-21
        5: [['09:00','14:00']], // Friday 9-14
        6: null // Saturday: no work
      }
    }
  ]
};

// Per-date schedule overrides for special days. Keyed by 'YYYY-MM-DD'.
// Use sparingly for one-off schedule changes so we don't alter history or defaults.
export const EMPLOYEE_SCHEDULE_OVERRIDES = {
  // Make Emmanouela work on Tuesday 2025-09-23 from 16:00 to 21:00 (one-off)
  '2025-09-23': {
    emmanouela: {
      2: [['16:00','21:00']]
    }
  }
};

// Mark Emmanouela off for 2025-09-25 through 2025-09-30 (inclusive)
['2025-09-25','2025-09-26','2025-09-27','2025-09-28','2025-09-29','2025-09-30'].forEach(d => {
  EMPLOYEE_SCHEDULE_OVERRIDES[d] = { ...(EMPLOYEE_SCHEDULE_OVERRIDES[d] || {}), emmanouela: null };
});

// Return the schedule ranges for employeeId on the given date (array of [start,end] or undefined/null)
export function getEmployeeScheduleForDate(employeeId, date) {
  if (!employeeId) return null;
  const day = dayjs(date);
  if (!day.isValid()) return null;
  const dayNum = day.day();
  const dateStr = day.format('YYYY-MM-DD');

  // Check per-date overrides first (highest precedence)
  try{
    const overridesForDate = EMPLOYEE_SCHEDULE_OVERRIDES[dateStr];
    if (overridesForDate && Object.prototype.hasOwnProperty.call(overridesForDate, employeeId)) {
      const empOverride = overridesForDate[employeeId];
      // empOverride may be null (explicit day off) or an object mapping weekday->ranges
      if (empOverride === null) return null;
      if (empOverride && empOverride[dayNum] !== undefined) return empOverride[dayNum] || null;
      return null;
    }
  }catch(e){ /* ignore and continue to history/fallback */ }

  // Check history first
  const history = EMPLOYEE_SCHEDULE_HISTORY[employeeId];
  if (Array.isArray(history) && history.length > 0) {
    // find the latest entry with effective <= date
    const candidates = history
      .map(h => ({ ...h, eff: dayjs(h.effective) }))
      .filter(h => h.eff.isValid() && (h.eff.isBefore(day) || h.eff.isSame(day, 'day')))
      .sort((a,b) => a.eff.isAfter(b.eff) ? -1 : 1);
    if (candidates.length > 0) {
      const selected = candidates[0];
      // return the ranges for the weekday (may be null)
      return selected.ranges ? (selected.ranges[dayNum] || null) : null;
    }
  }

  // Fallback to default schedule mapping
  const fallback = EMPLOYEE_SCHEDULE[employeeId];
  if (!fallback) return null;
  return fallback[dayNum] || null;
}
