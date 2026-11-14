// Dates are plain "YYYY-MM-DD" strings in the phone's own calendar.

const pad = (n) => String(n).padStart(2, '0');

// The phone's local calendar date, never UTC: 23:59 and 00:01 are two days.
export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Calendar arithmetic in UTC, so clock changes cannot shift the result.
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
