import { apiGet, apiPost, apiPut, apiDelete, apiResponse } from './client';

/**
 * Schedule Management API
 * 100% Database-backed via Spring Boot REST endpoints.
 * ZERO mock data. ZERO localStorage persistence.
 */

export function parseTimeMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toUpperCase() : null;

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function sortSchedulesByTime(schedulesList) {
  return [...(schedulesList || [])].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return parseTimeMinutes(a.time) - parseTimeMinutes(b.time);
  });
}

export function computeDynamicStatus(schedule, now = new Date()) {
  if (schedule.status === 'Completed' || schedule.status === 'Rescheduled' || schedule.status === 'Postponed') {
    return schedule.status;
  }

  const timeStr = schedule.time || '';
  const parts = timeStr.split('-');
  const startStr = parts[0] ? parts[0].trim() : '';
  const endStr = parts[1] ? parts[1].trim() : startStr;

  const startMins = parseTimeMinutes(startStr);
  let endMins = parseTimeMinutes(endStr);
  if (endMins <= startMins) endMins = startMins + 60;

  const dStr = schedule.date || new Date().toISOString().split('T')[0];
  const dateParts = dStr.split('-').map(Number);
  if (dateParts.length < 3) return schedule.status || 'Upcoming';

  const [year, month, day] = dateParts;
  const startDate = new Date(year, month - 1, day, Math.floor(startMins / 60), startMins % 60);
  const endDate = new Date(year, month - 1, day, Math.floor(endMins / 60), endMins % 60);

  if (now < startDate) {
    return 'Upcoming';
  } else if (now > endDate && schedule.date < new Date().toISOString().split('T')[0]) {
    return 'Completed';
  } else {
    return schedule.status || 'Upcoming';
  }
}

export const getSchedules = async () => {
  let res = await apiGet('/me/schedules');
  if (!res.success) {
    res = await apiGet('/schedules');
  }
  if (res.success && Array.isArray(res.data)) {
    const sorted = sortSchedulesByTime(res.data.map(s => ({
      ...s,
      status: computeDynamicStatus(s)
    })));
    return apiResponse(sorted);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch schedules');
};

export const getTrainerSchedules = async (trainerName) => {
  if (!trainerName) {
    return apiResponse([], false, 'Trainer identifier is required');
  }
  const res = await apiGet(`/schedules/trainer/${encodeURIComponent(trainerName)}`);
  if (res.success && Array.isArray(res.data)) {
    const sorted = sortSchedulesByTime(res.data.map(s => ({
      ...s,
      status: computeDynamicStatus(s)
    })));
    return apiResponse(sorted);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch trainer schedules');
};

export const createSchedule = async (scheduleData) => {
  const payload = {
    ...scheduleData,
    status: scheduleData?.status || 'Upcoming'
  };
  const res = await apiPost('/schedules', payload);
  if (res.success && res.data) {
    return apiResponse(res.data, true, 'Schedule created successfully');
  }
  return apiResponse(null, false, res.message || 'Failed to create schedule');
};

export const updateSchedule = async (id, updatedData) => {
  if (!id) {
    return apiResponse(null, false, 'Schedule ID is required');
  }
  const res = await apiPut(`/schedules/${encodeURIComponent(id)}`, updatedData);
  if (res.success && res.data) {
    return apiResponse(res.data, true, 'Schedule updated successfully');
  }
  return apiResponse(null, false, res.message || 'Failed to update schedule');
};

export const deleteSchedule = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Schedule ID is required');
  }
  const res = await apiDelete(`/schedules/${encodeURIComponent(id)}`);
  if (res.success) {
    return apiResponse(true, true, 'Schedule deleted successfully');
  }
  return apiResponse(false, false, res.message || 'Failed to delete schedule');
};

export const joinSchedule = async (id) => {
  if (!id) {
    return apiResponse(null, false, 'Schedule ID is required');
  }
  const res = await apiPost(`/schedules/${encodeURIComponent(id)}/join`);
  return res;
};

export const startSchedule = async (id) => {
  if (!id) {
    return apiResponse(null, false, 'Schedule ID is required');
  }
  const res = await apiPost(`/schedules/${encodeURIComponent(id)}/start`);
  return res;
};

export const getAdminTrainerSessions = async () => {
  const res = await apiGet('/schedules/admin/trainer-sessions');
  return res;
};

export const getOnlineSessionHistory = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.trainerId && params.trainerId !== 'all') query.append('trainerId', params.trainerId);
  if (params.fromDate) query.append('fromDate', params.fromDate);
  if (params.toDate) query.append('toDate', params.toDate);
  const qs = query.toString();
  const url = qs ? `/schedules/online-session-history?${qs}` : '/schedules/online-session-history';
  return await apiGet(url);
};

export const getUnpaidCreditedSessions = async ({ trainerId, fromDate, toDate }) => {
  if (!trainerId || !fromDate || !toDate) {
    return apiResponse([], false, 'Trainer, From date and To date are required');
  }
  const query = new URLSearchParams({ trainerId, fromDate, toDate }).toString();
  return await apiGet(`/schedules/unpaid-credited-sessions?${query}`);
};


