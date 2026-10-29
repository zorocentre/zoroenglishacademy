import { apiGet, apiPost, apiPut, apiDelete, apiResponse } from './client';

export const getMyNotifications = async () => {
  const res = await apiGet('/me/notifications');
  if (res && res.success && Array.isArray(res.data)) {
    const normalized = res.data.map(n => ({
      id: n.id,
      trainerName: n.recipientId || '',
      recipientRole: n.recipientRole || 'ALL',
      title: n.title || '',
      desc: n.message || '',
      message: n.message || '',
      readStatus: n.readStatus || false,
      createdAt: n.createdAt,
      time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      date: n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : '',
      type: 'system'
    }));
    return apiResponse(normalized);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch notifications');
};

export const getNotifications = async () => {
  const res = await apiGet('/notifications');
  if (res && res.success && Array.isArray(res.data)) {
    const normalized = res.data.map(n => ({
      id: n.id,
      trainerName: n.recipientId || '',
      recipientRole: n.recipientRole || 'ALL',
      title: n.title || '',
      desc: n.message || '',
      message: n.message || '',
      readStatus: n.readStatus || false,
      createdAt: n.createdAt,
      time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      date: n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : '',
      type: 'system'
    }));
    return apiResponse(normalized);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch notifications');
};

export const createNotification = async (notifData) => {
  const payload = {
    recipientRole: notifData?.recipientRole || (notifData?.trainerName ? 'TRAINER' : 'ALL'),
    recipientId: notifData?.trainerName || notifData?.recipientId || null,
    title: notifData?.title || 'Notification',
    message: notifData?.desc || notifData?.message || '',
    readStatus: false
  };

  const res = await apiPost('/notifications', payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to create notification');
};

export const markNotificationRead = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Notification ID is required');
  }
  const res = await apiPut(`/notifications/${encodeURIComponent(id)}/read`, {});
  return apiResponse(res?.success || false, res?.success || false, res?.message);
};

export const deleteNotification = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Notification ID is required');
  }
  const res = await apiDelete(`/notifications/${encodeURIComponent(id)}`);
  return apiResponse(res?.success || false, res?.success || false, res?.message);
};

export const notifyScheduleCreated = async (schedule) => {
  const title = `New Session Scheduled: ${schedule?.title || schedule?.course || 'Session'}`;
  const desc = `Class scheduled for batch ${schedule?.batch || 'General'} on ${schedule?.date || 'Upcoming'} (${schedule?.time || '10:00 AM'}). Mode: ${schedule?.mode || 'Online'}`;

  return await createNotification({
    trainerName: schedule?.trainer,
    title,
    desc,
    type: 'schedule_created'
  });
};

export const notifyScheduleChange = async (schedule, actionType, originalDate, originalTime, newDate, newTime) => {
  const isReschedule = actionType === 'Rescheduled';
  const title = `${schedule?.course || 'Course'} (${schedule?.batch || 'Batch'}) ${isReschedule ? 'Rescheduled' : 'Postponed'}`;
  const desc = `${schedule?.batch || 'Batch'} session has been ${isReschedule ? 'rescheduled' : 'postponed'}.\nOriginal: ${originalDate}, ${originalTime}\nNew: ${newDate}, ${newTime}`;

  return await createNotification({
    trainerName: schedule?.trainer,
    title,
    desc,
    type: isReschedule ? 'reschedule' : 'postpone'
  });
};

export const getTrainerNotifications = async (trainerNameOrEmail) => {
  const res = await getMyNotifications();
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    return res;
  }
  const fallbackRes = await getNotifications();
  if (!fallbackRes.success) {
    return apiResponse([], false, fallbackRes?.message || 'Failed to fetch trainer notifications');
  }
  const lowerQuery = (trainerNameOrEmail || '').toLowerCase().trim();

  const trainerNotifs = (fallbackRes.data || []).filter(n => {
    if (!n.trainerName) return true;
    const nLower = n.trainerName.toLowerCase();
    return nLower.includes(lowerQuery) || lowerQuery.includes(nLower);
  });

  return apiResponse(trainerNotifs);
};
