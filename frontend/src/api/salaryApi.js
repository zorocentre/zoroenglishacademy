import { apiGet, apiPost, apiPut, apiDelete, apiResponse } from './client';

export const getSalaryPayments = async () => {
  const res = await apiGet('/salary-records');
  if (res && res.success && Array.isArray(res.data)) {
    const normalized = res.data.map(s => {
      const online = parseFloat(s.onlineSessionSalary || 0);
      const recorded = parseFloat(s.recordedSessionSalary || 0);
      const total = parseFloat(s.totalSalary || s.amount || 0);
      return {
        id: s.id,
        trainerId: s.trainerId,
        trainerName: s.trainerName || 'Trainer',
        month: s.month || '',
        fromDate: s.fromDate || '',
        toDate: s.toDate || '',
        onlineSessionSalary: online,
        recordedSessionSalary: recorded,
        totalSalary: total,
        amount: total,
        date: s.paymentDate || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : ''),
        paymentDate: s.paymentDate || '',
        method: s.paymentMethod || 'Bank Transfer',
        paymentMethod: s.paymentMethod || 'Bank Transfer',
        reference: s.transactionId || '',
        transactionId: s.transactionId || '',
        notes: s.notes || '',
        status: s.status || 'Paid',
        sessionCount: s.sessionCount || 0,
        creditedHours: parseFloat(s.creditedHours || 0),
        createdBy: s.createdBy || '',
        createdAt: s.createdAt
      };
    });
    // Sort descending by paymentDate or createdAt
    normalized.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || '') || (b.id || '').localeCompare(a.id || ''));
    return apiResponse(normalized);
  }
  return apiResponse([], false, res?.message || 'Failed to fetch salary records');
};

export const getSalaries = getSalaryPayments;

export const createSalaryPayment = async (data) => {
  const online = parseFloat(data.onlineSessionSalary || 0);
  const recorded = parseFloat(data.recordedSessionSalary || 0);
  const total = online + recorded;

  const payload = {
    trainerId: data.trainerId,
    trainerName: data.trainerName || 'Trainer',
    fromDate: data.fromDate,
    toDate: data.toDate,
    month: data.month || `${data.fromDate} to ${data.toDate}`,
    onlineSessionSalary: online,
    recordedSessionSalary: recorded,
    totalSalary: total,
    amount: total,
    paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    transactionId: data.transactionId || data.reference || '',
    notes: data.notes || '',
    status: 'Paid'
  };

  const res = await apiPost('/salary-records', payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to record salary');
};

export const getPaymentSessions = async (paymentId) => {
  if (!paymentId) {
    return apiResponse([], false, 'Payment ID is required');
  }
  const res = await apiGet(`/salary-records/${encodeURIComponent(paymentId)}/sessions`);
  return res;
};

export const updateSalaryPayment = async (id, data) => {
  if (!id) {
    return apiResponse(null, false, 'Salary record ID is required');
  }
  const payload = {
    ...data,
    amount: parseFloat(data?.amount || data?.totalSalary || 0)
  };

  const res = await apiPut(`/salary-records/${encodeURIComponent(id)}`, payload);
  if (res && res.success) {
    return apiResponse(res.data);
  }
  return apiResponse(null, false, res?.message || 'Failed to update salary');
};

export const deleteSalaryPayment = async (id) => {
  if (!id) {
    return apiResponse(false, false, 'Salary record ID is required');
  }
  const res = await apiDelete(`/salary-records/${encodeURIComponent(id)}`);
  if (res && res.success) {
    return apiResponse(true);
  }
  return apiResponse(false, false, res?.message || 'Failed to delete salary');
};

export const getSalaryStats = async () => {
  const salRes = await getSalaryPayments();
  if (!salRes.success) {
    return apiResponse({
      totalPaid: 0,
      totalOnlineSalary: 0,
      totalRecordedSalary: 0,
      totalRecords: 0
    }, false, salRes?.message || 'Failed to fetch salary stats');
  }
  const list = salRes.data || [];
  const totalPaid = list.reduce((acc, curr) => acc + (parseFloat(curr.totalSalary || curr.amount) || 0), 0);
  const totalOnlineSalary = list.reduce((acc, curr) => acc + (parseFloat(curr.onlineSessionSalary) || 0), 0);
  const totalRecordedSalary = list.reduce((acc, curr) => acc + (parseFloat(curr.recordedSessionSalary) || 0), 0);

  return apiResponse({
    totalPaid,
    totalOnlineSalary,
    totalRecordedSalary,
    totalRecords: list.length
  });
};
