import { apiGet, apiPost, apiResponse, getItem } from './client';

export const getActivityLogs = async (fromDate, toDate, moduleFilter, actionFilter, actorFilter) => {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (moduleFilter && moduleFilter !== 'ALL') params.set('module', moduleFilter);
  if (actionFilter && actionFilter !== 'ALL') params.set('action', actionFilter);
  if (actorFilter && actorFilter !== 'ALL') params.set('actor', actorFilter);

  const query = params.toString();
  const url = query ? `/activity-logs?${query}` : '/activity-logs';
  const res = await apiGet(url);
  if (!res || !res.success) {
    return {
      success: false,
      message: res?.message || 'Failed to fetch activity logs',
      data: null
    };
  }

  let logs = (res.data || []).map(l => ({
    id: l.id,
    date: l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : '',
    time: l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    createdAt: l.createdAt,
    module: l.module || 'GENERAL',
    category: l.module || l.action || 'General',
    action: l.action || 'Action',
    details: l.details || '',
    userName: l.userName || 'Admin',
    userId: l.userId
  }));

  return apiResponse(logs);
};

export const logActivity = async (category, action, details) => {
  let user = getItem('user');
  if (!user && typeof window !== 'undefined' && window.sessionStorage) {
    const userStr = sessionStorage.getItem('zoro_user') || sessionStorage.getItem('user');
    if (userStr) {
      try { user = JSON.parse(userStr); } catch (e) {}
    }
  }

  const payload = {
    userId: user?.id || 'admin',
    userName: user?.name || user?.email || 'Administrator',
    action: category ? `${category}: ${action}` : action,
    details: details || ''
  };

  const res = await apiPost('/activity-logs', payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return {
    success: false,
    message: res?.message || 'Failed to log activity',
    data: null
  };
};
