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

// Return the schedule ranges for employeeId on the given date (array of [start,end] or undefined/null)
export function getEmployeeScheduleForDate(employeeId, date) {
  if (!employeeId) return null;
  const day = dayjs(date);
  if (!day.isValid()) return null;
  const dayNum = day.day();

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
