/**
 * Formats a date string (e.g. "2026-10-01" or ISO timestamp) to DD/MM/YYYY.
 * Returns empty string if dateStr is blank or invalid.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (!trimmed) return '';

  // If already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;

  // Check YYYY-MM-DD
  const rawDate = trimmed.split('T')[0];
  const parts = rawDate.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Fallback to Date parsing
  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return trimmed;
  }
}

/**
 * Formats submission timestamps in Asia/Kolkata timezone with 12-hour AM/PM format.
 * Tolerant to UTC ISO strings, UTC epoch timestamps, and legacy unzoned server strings.
 */
export function formatSubmissionTime(ts) {
  if (!ts) return '';
  const trimmed = String(ts).trim();
  if (!trimmed) return '';

  let d = null;
  if (trimmed.includes('T') || trimmed.includes('Z') || (trimmed.includes('-') && !trimmed.includes('/'))) {
    d = new Date(trimmed);
  } else if (/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    let hour = parseInt(match[4], 10);
    let min = parseInt(match[5], 10);
    const ampm = (match[6] || '').toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    d = new Date(Date.UTC(year, month, day, hour, min));
  } else {
    d = new Date(trimmed);
  }

  if (isNaN(d.getTime())) return trimmed;

  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Converts a UTC ISO string to YYYY-MM-DDTHH:mm representing Asia/Kolkata local time,
 * suitable for <input type="datetime-local" />.
 */
export function toIstDatetimeInput(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const partMap = {};
  parts.forEach(p => { partMap[p.type] = p.value; });
  const hour = (partMap.hour === '24') ? '00' : partMap.hour;
  return `${partMap.year}-${partMap.month}-${partMap.day}T${hour}:${partMap.minute}`;
}

/**
 * Converts an <input type="datetime-local" /> value (e.g. "2026-11-01T10:00")
 * strictly interpreted as Asia/Kolkata (+05:30) into a UTC ISO string.
 */
export function istInputToUtcIso(localDtStr) {
  if (!localDtStr) return null;
  let normalized = String(localDtStr).trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    normalized += ':00';
  }
  if (!normalized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += '+05:30';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
