/**
 * Utility for parsing schedule time strings and sorting schedule items chronologically,
 * and evaluating lock states in Asia/Kolkata timezone (Requirement B3).
 */
import { API_BASE_URL } from '../api/client';

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  // If time string is a range like "05:00 PM - 06:00 PM", extract the start time "05:00 PM"
  const startPart = String(timeStr).split('-')[0].trim();
  const match = startPart.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

export function sortSchedulesChronologically(schedulesList) {
  if (!Array.isArray(schedulesList)) return [];
  return [...schedulesList].sort((a, b) => {
    // 1. Sort by DATE ascending if both items have valid dates and they differ
    if (a.date && b.date && a.date !== b.date) {
      return String(a.date).localeCompare(String(b.date));
    }
    // 2. Sort by START TIME ascending numerically in minutes from midnight
    return parseTimeToMinutes(a.time || a.startTime) - parseTimeToMinutes(b.time || b.startTime);
  });
}

let serverTimeOffset = 0;

export async function syncServerTime() {
  try {
    const res = await fetch(`${API_BASE_URL}/time`);
    if (res.ok) {
      const json = await res.json();
      const data = json?.data || json;
      const serverEpoch = data.epochMillis || data.serverTime || data.serverNow;
      if (typeof serverEpoch === 'number') {
        serverTimeOffset = serverEpoch - Date.now();
      }
    }
  } catch (e) {
    console.warn('Failed to sync server time, falling back to local time:', e);
  }
  return serverTimeOffset;
}

export function setServerTimeOffset(offsetMs) {
  serverTimeOffset = typeof offsetMs === 'number' ? offsetMs : 0;
}

export function getServerTimeOffset() {
  return serverTimeOffset;
}

export function getServerNow() {
  return new Date(Date.now() + serverTimeOffset);
}

export function getNowInKolkata(baseDate = getServerNow()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(baseDate);

  const get = type => parts.find(p => p.type === type)?.value;
  const year = parseInt(get('year') || '2026', 10);
  const month = parseInt(get('month') || '1', 10) - 1;
  const day = parseInt(get('day') || '1', 10);
  const hour = parseInt(get('hour') || '0', 10);
  const minute = parseInt(get('minute') || '0', 10);
  const second = parseInt(get('second') || '0', 10);

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

export function getSessionStartDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const dParts = String(dateStr).trim().split('-');
  if (dParts.length !== 3) return null;
  const year = parseInt(dParts[0], 10);
  const month = parseInt(dParts[1], 10) - 1;
  const day = parseInt(dParts[2], 10);

  const startMinutes = parseTimeToMinutes(timeStr);
  const hour = Math.floor(startMinutes / 60);
  const minute = startMinutes % 60;

  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

export function getSessionEndDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const dParts = String(dateStr).trim().split('-');
  if (dParts.length !== 3) return null;
  const year = parseInt(dParts[0], 10);
  const month = parseInt(dParts[1], 10) - 1;
  const day = parseInt(dParts[2], 10);

  let endMinutes = 0;
  const timeParts = String(timeStr || '').split('-');
  if (timeParts.length > 1) {
    endMinutes = parseTimeToMinutes(timeParts[1].trim());
  } else {
    endMinutes = parseTimeToMinutes(timeStr) + 60;
  }
  const hour = Math.floor(endMinutes / 60);
  const minute = endMinutes % 60;

  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

export const RESOURCES_UNLOCK_MINUTES = 30;

export function getUnlockTimeString(dateStr, timeStr, unlockMinutes = RESOURCES_UNLOCK_MINUTES) {
  const start = getSessionStartDateTime(dateStr, timeStr);
  if (!start) return `${unlockMinutes} mins before class`;
  const unlockDate = new Date(start.getTime() - unlockMinutes * 60 * 1000);
  let hours = unlockDate.getUTCHours();
  const minutes = unlockDate.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const pad = n => String(n).padStart(2, '0');
  return `Unlocks at ${pad(hours)}:${pad(minutes)} ${ampm}`;
}

export function evaluateScheduleLocks(schedulesList, nowInKolkata = getNowInKolkata(), unlockMinutes = RESOURCES_UNLOCK_MINUTES) {
  const sorted = sortSchedulesChronologically(schedulesList);
  const nowMs = nowInKolkata.getTime();

  return sorted.map(sch => {
    const start = getSessionStartDateTime(sch.date, sch.time || sch.startTime);
    const end = getSessionEndDateTime(sch.date, sch.time || sch.endTime);
    const startMs = start ? start.getTime() : 0;
    const endMs = end ? end.getTime() : (startMs + 60 * 60 * 1000);

    let status = 'UPCOMING';
    if (nowMs >= endMs) {
      status = 'COMPLETED';
    } else if (nowMs >= startMs && nowMs < endMs) {
      status = 'LIVE';
    } else {
      status = 'UPCOMING';
    }

    let isLocked = false;
    let unlockLabel = '';

    if (status === 'COMPLETED' || status === 'LIVE') {
      // Past / completed / live sessions keep documents visible
      isLocked = false;
    } else {
      // Upcoming session locked until unlockMinutes (60 min) before start time
      const unlockThresholdMs = startMs - unlockMinutes * 60 * 1000;
      if (nowMs >= unlockThresholdMs) {
        // Within 60 minutes before start time -> unlocked
        isLocked = false;
      } else {
        // Locked until 60 minutes before start (no nearest upcoming exception)
        isLocked = true;
        unlockLabel = getUnlockTimeString(sch.date, sch.time || sch.startTime, unlockMinutes);
      }
    }

    // Also honor backend flag if explicitly set
    if (sch.locked === true) {
      isLocked = true;
      if (!unlockLabel) {
        unlockLabel = getUnlockTimeString(sch.date, sch.time || sch.startTime, unlockMinutes);
      }
    }

    return {
      ...sch,
      status,
      isLocked,
      unlockLabel
    };
  });
}

export function normalizeGoogleMeetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() !== 'meet.google.com') {
      return '';
    }
    const path = parsed.pathname || '';
    const lower = path.toLowerCase();
    if (lower.includes('/new') || lower.includes('/zoro-live-class')) {
      return '';
    }
    // Match code xxx-xxxx-xxx with optional /meet/ or other prefix
    const codeMatch = path.match(/(?:[a-zA-Z]+\/)?([a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3})/i);
    if (codeMatch) {
      return 'https://meet.google.com/' + codeMatch[1].toLowerCase();
    }
    // Match lookup/<id>
    const lookupMatch = path.match(/\/lookup\/([a-zA-Z0-9_-]+)/i);
    if (lookupMatch) {
      return 'https://meet.google.com/lookup/' + lookupMatch[1].toLowerCase();
    }
    // Match general code
    const generalMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/i);
    if (generalMatch && generalMatch[1].length >= 3) {
      return 'https://meet.google.com/' + generalMatch[1].toLowerCase();
    }
    return '';
  } catch (e) {
    return '';
  }
}

export function isValidGoogleMeetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const normalized = normalizeGoogleMeetUrl(url);
  return Boolean(normalized && normalized.startsWith('https://meet.google.com/'));
}

export function getScheduleJoinState(sch, nowInKolkata = getNowInKolkata()) {
  const meetUrl = sch?.meetUrl || sch?.googleMeetUrl || sch?.meetingUrl || sch?.meetLink || '';
  const hasValidLink = isValidGoogleMeetUrl(meetUrl);

  const start = getSessionStartDateTime(sch?.date, sch?.time || sch?.startTime);
  const end = getSessionEndDateTime(sch?.date, sch?.time || sch?.endTime);

  if (!start) {
    return {
      enabled: false,
      label: hasValidLink ? 'Join Unavailable' : 'Meeting link not set. Contact admin.',
      meetUrl,
      hasValidLink
    };
  }

  const nowMs = nowInKolkata.getTime();
  const startMs = start.getTime();
  const endMs = end ? end.getTime() : (startMs + 60 * 60 * 1000);

  if (!hasValidLink) {
    return {
      enabled: false,
      label: 'Meeting link not set. Contact admin.',
      meetUrl: '',
      hasValidLink: false
    };
  }

  if (nowMs < startMs) {
    const startPart = String(sch?.time || sch?.startTime || '').split('-')[0].trim() || 'scheduled time';
    return {
      enabled: false,
      label: `Join opens at ${startPart}`,
      meetUrl,
      hasValidLink: true
    };
  }

  if (nowMs >= startMs && nowMs <= endMs) {
    return {
      enabled: true,
      label: 'JOIN NOW (Google Meet)',
      meetUrl,
      hasValidLink: true
    };
  }

  return {
    enabled: false,
    label: 'Session ended',
    meetUrl,
    hasValidLink: true
  };
}

