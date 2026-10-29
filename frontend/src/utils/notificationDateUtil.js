/**
 * Notification date and time formatting utility.
 * Formats timestamps in user's local timezone (Asia/Kolkata) with relative time and exact hover text.
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Returns formatted relative time and exact timestamp for tooltip
 * @param {string|Date} dateInput ISO 8601 UTC timestamp or Date object
 * @returns {{ relative: string, exact: string, full: string }}
 */
export function formatNotificationTime(dateInput) {
  if (!dateInput) {
    return { relative: 'Just now', exact: 'Just now', full: '' };
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return { relative: String(dateInput), exact: String(dateInput), full: String(dateInput) };
  }

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Exact date/time in Asia/Kolkata for hover tooltip
  const exactFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const exact = exactFormatter.format(date);

  // Relative calculation
  if (diffSec < 60) {
    return { relative: 'Just now', exact, full: exact };
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return { relative: `${diffMin} min ago`, exact, full: exact };
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return { relative: `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`, exact, full: exact };
  }

  // Check if yesterday
  const nowDay = new Intl.DateTimeFormat('en-IN', { timeZone: TIMEZONE, day: 'numeric' }).format(now);
  const dateDay = new Intl.DateTimeFormat('en-IN', { timeZone: TIMEZONE, day: 'numeric' }).format(date);
  if (diffHours < 48 && Number(nowDay) - Number(dateDay) === 1) {
    const timeOnly = new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
    return { relative: `Yesterday at ${timeOnly}`, exact, full: exact };
  }

  // Older than yesterday: show date
  const sameYear = now.getFullYear() === date.getFullYear();
  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  });
  const relative = dateFormatter.format(date);

  return { relative, exact, full: exact };
}
