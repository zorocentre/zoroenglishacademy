import React, { useState, useEffect } from 'react';
import { Plus, User, Users, GraduationCap, CheckCircle2, Edit2, Trash2, X, AlertTriangle, RefreshCw, Eye, Upload, Search } from 'lucide-react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../api/scheduleApi';
import { uploadFile } from '../../api/fileApi';
import { getTrainers } from '../../api/userApi';
import { getCourses } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { notifyScheduleChange, notifyScheduleCreated } from '../../api/notificationApi';
import { logActivity } from '../../api/activityLogApi';
import ConfirmModal from '../common/ConfirmModal';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';
import { useDialog } from '../../context/DialogContext';
import { isValidGoogleMeetUrl, parseTimeToMinutes } from '../../utils/scheduleSortUtil';

const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt',
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'mp4', 'mov', 'avi', 'webm',
  'mp3', 'wav', 'm4a'
];

function time24ToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime24(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function time24To12(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTimeSlot(start24, end24) {
  return `${time24To12(start24)} - ${time24To12(end24)}`;
}

function parseSlotTo24(slot) {
  if (!slot) return { start: '17:00', end: '18:00' };
  const parts = slot.split('-');
  const sPart = parts[0]?.trim();
  const ePart = parts[1]?.trim();
  const sMin = parseTimeToMinutes(sPart);
  const eMin = ePart ? parseTimeToMinutes(ePart) : sMin + 60;
  return {
    start: minutesToTime24(sMin),
    end: minutesToTime24(eMin)
  };
}

function getBatchTrainers(batch, allTrainers = []) {
  if (!batch) return [];
  if (Array.isArray(batch.trainers) && batch.trainers.length > 0) {
    return batch.trainers.map(t => {
      if (typeof t === 'string') {
        const found = allTrainers.find(tr => tr.id === t || tr.name?.toLowerCase() === t.toLowerCase());
        return { id: found?.id || t, name: found?.name || t };
      }
      return { id: t.id || t.trainerId, name: t.name || t.trainerName };
    });
  }
  if (Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0) {
    return batch.trainerIds.map(tId => {
      const found = allTrainers.find(t => t.id === tId);
      return { id: tId, name: found?.name || tId };
    });
  }
  if (batch.trainerName) {
    const names = batch.trainerName.split(',').map(n => n.trim()).filter(Boolean);
    const ids = batch.trainerId ? batch.trainerId.split(',').map(i => i.trim()).filter(Boolean) : [];
    return names.map((name, idx) => ({
      id: ids[idx] || (allTrainers.find(t => t.name?.toLowerCase() === name.toLowerCase())?.id || name),
      name
    }));
  }
  return [];
}

export default function AdminSchedulePage() {
  const { showSuccess, showError, showWarning, confirm } = useDialog();
  const [activeScheduleTab, setActiveScheduleTab] = useState('student'); // 'student' | 'trainer'
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('All');
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState('All');
  const [selectedTrainerCourseFilter, setSelectedTrainerCourseFilter] = useState('All');
  const [searchScheduleTitle, setSearchScheduleTitle] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [notifToast, setNotifToast] = useState(null);

  const [schedules, setSchedules] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batchesList, setBatchesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [fileErrors, setFileErrors] = useState({});

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    course: '',
    batch: '',
    trainer: '',
    startTime: '17:00',
    endTime: '18:00',
    time: '05:00 PM - 06:00 PM',
    date: todayStr,
    notesFile: null,
    worksheetFile: null,
    assignmentFile: null
  });

  const [rescheduleFormData, setRescheduleFormData] = useState({
    newDate: todayStr,
    newStartTime: '10:00',
    newEndTime: '11:00',
    newTime: '10:00 AM - 11:00 AM'
  });

  const loadSchedules = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getSchedules();
      setSchedules(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      setLoadError('Unable to load schedules. Please check network connection.');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const trRes = await getTrainers();
      const loadedTrainers = Array.isArray(trRes?.data) ? trRes.data : [];
      setTrainers(loadedTrainers);

      const crsRes = await getCourses();
      const loadedCourses = Array.isArray(crsRes?.data) ? crsRes.data : [];
      setCourses(loadedCourses);

      const bRes = await getBatches();
      const loadedBatches = Array.isArray(bRes?.data) ? bRes.data : [];
      setBatchesList(loadedBatches);

      // Only show Online & Hybrid courses in Schedule Management
      const liveCourses = loadedCourses.filter(c => c.mode === 'Online' || c.mode === 'Hybrid' || !c.mode);
      const studentLive = liveCourses.filter(c => c.audience !== 'trainer');
      const defaultCourse = studentLive[0] || liveCourses[0];

      if (defaultCourse) {
        const firstCourse = defaultCourse.title;
        const matchingBatches = loadedBatches.filter(b => b.courseName === firstCourse && b.status === 'Active');
        const defaultBatch = matchingBatches[0];
        const bTrainers = getBatchTrainers(defaultBatch, loadedTrainers);
        const defaultTrainer = bTrainers.length === 1 ? bTrainers[0].name : '';

        setFormData(prev => ({
          ...prev,
          course: firstCourse,
          batch: defaultBatch?.name || '',
          trainer: defaultTrainer
        }));
      }
    } catch (err) {
      console.error('Error loading metadata for schedules:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
    loadMetadata();
  }, []);

  const handleCourseChangeInForm = (newCourseTitle) => {
    const selectedCrs = (courses || []).find(c => c.title === newCourseTitle);
    const isTrainerCrs = selectedCrs?.audience === 'trainer';

    if (isTrainerCrs) {
      setFormData(prev => ({
        ...prev,
        course: newCourseTitle,
        batch: '',
        trainer: 'Admin'
      }));
    } else {
      const courseBatches = (batchesList || []).filter(b => b.courseName === newCourseTitle && b.status === 'Active');
      const firstBatch = courseBatches[0];
      const bTrainers = getBatchTrainers(firstBatch, trainers);
      const chosenTrainer = bTrainers.length === 1 ? bTrainers[0].name : '';

      setFormData(prev => ({
        ...prev,
        course: newCourseTitle,
        batch: firstBatch ? firstBatch.name : '',
        trainer: chosenTrainer
      }));
    }
  };

  const handleBatchChangeInForm = (newBatchName) => {
    const selectedBatchObj = (batchesList || []).find(b => b.name === newBatchName && b.courseName === formData.course);
    const bTrainers = getBatchTrainers(selectedBatchObj, trainers);
    let chosenTrainer = '';
    if (bTrainers.length === 1) {
      chosenTrainer = bTrainers[0].name;
    } else if (bTrainers.length > 1) {
      const exists = bTrainers.some(t => t.name === formData.trainer);
      chosenTrainer = exists ? formData.trainer : '';
    }

    setFormData(prev => ({
      ...prev,
      batch: newBatchName,
      trainer: chosenTrainer
    }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setFileErrors(prev => ({ 
        ...prev, 
        [fieldName]: `Unsupported file type (.${ext}). Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}` 
      }));
      e.target.value = '';
      return;
    }

    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX_SIZE) {
      setFileErrors(prev => ({ ...prev, [fieldName]: 'File size must be 100 MB or less.' }));
      e.target.value = '';
      return;
    }

    setFileErrors(prev => ({ ...prev, [fieldName]: '' }));
    const catName = fieldName === 'notesFile' ? 'notes' : fieldName === 'worksheetFile' ? 'worksheet' : 'assignment';

    try {
      const res = await uploadFile(file, catName);
      const category = fieldName === 'notesFile' ? 'Notes' : fieldName === 'worksheetFile' ? 'Worksheet' : 'Assignment';
      setFormData(prev => ({
        ...prev,
        [fieldName]: {
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: ext,
          uploadedAt: new Date().toLocaleDateString('en-GB'),
          fileUrl: res.url,
          category
        }
      }));
    } catch (err) {
      setFileErrors(prev => ({ ...prev, [fieldName]: err.message || 'Upload failed' }));
    }
  };

  const handleReuploadScheduleFile = async (scheduleItem, fieldName, file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      showWarning(`Unsupported file type (.${ext}). Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}`, 'Unsupported Format');
      return;
    }
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showWarning('File size must be 100 MB or less.', 'File Too Large');
      return;
    }

    const catName = fieldName === 'notesFile' ? 'notes' : fieldName === 'worksheetFile' ? 'worksheet' : 'assignment';
    try {
      const res = await uploadFile(file, catName);
      const category = fieldName === 'notesFile' ? 'Notes' : fieldName === 'worksheetFile' ? 'Worksheet' : 'Assignment';
      const newFileObj = {
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: ext,
        uploadedAt: new Date().toLocaleDateString('en-GB'),
        fileUrl: res.url,
        category
      };

      const updatedItem = {
        ...scheduleItem,
        [fieldName]: newFileObj
      };
      await updateSchedule(scheduleItem.id, updatedItem);
      logActivity('Schedule Attachment Re-uploaded', `Re-uploaded ${category} file "${file.name}" for schedule session "${scheduleItem.title}"`, 'Schedule');
      setNotifToast({
        title: 'Attachment Re-uploaded',
        message: `${category} file updated for session "${scheduleItem.title}".`
      });
      await loadSchedules();
    } catch (err) {
      showError(err.message || 'Re-upload failed', 'Upload Error');
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingSchedule(item);
    const parsed = parseSlotTo24(item.time || item.startTime);
    const st = item.startTime || parsed.start;
    const et = item.endTime || parsed.end;
    setFormData({
      title: item.title || '',
      course: item.course || '',
      batch: item.batch || '',
      trainer: item.trainer || '',
      startTime: st,
      endTime: et,
      time: item.time || formatTimeSlot(st, et),
      date: item.date || todayStr,
      notesFile: item.notesFile || null,
      worksheetFile: item.worksheetFile || null,
      assignmentFile: item.assignmentFile || null
    });
    setFileErrors({});
    setShowAddModal(true);
  };

  const startM = time24ToMinutes(formData.startTime);
  const endM = time24ToMinutes(formData.endTime);
  const durationM = endM > startM ? endM - startM : 0;
  const durationHours = Math.floor(durationM / 60);
  const durationRemM = durationM % 60;
  const durationPreview = durationM > 0
    ? `${durationHours > 0 ? `${durationHours}h ` : ''}${durationRemM > 0 ? `${durationRemM}m` : ''} (${durationM} min)`
    : 'Invalid (End must be after Start)';

  const handleQuickDuration = (minutes) => {
    const sM = time24ToMinutes(formData.startTime) || 10 * 60;
    const eM = sM + minutes;
    const newEnd = minutesToTime24(eM);
    setFormData(prev => ({
      ...prev,
      endTime: newEnd,
      time: formatTimeSlot(prev.startTime, newEnd)
    }));
  };

  const rStartM = time24ToMinutes(rescheduleFormData.newStartTime);
  const rEndM = time24ToMinutes(rescheduleFormData.newEndTime);
  const rDurationM = rEndM > rStartM ? rEndM - rStartM : 0;
  const rDurationHours = Math.floor(rDurationM / 60);
  const rDurationRemM = rDurationM % 60;
  const rDurationPreview = rDurationM > 0
    ? `${rDurationHours > 0 ? `${rDurationHours}h ` : ''}${rDurationRemM > 0 ? `${rDurationRemM}m` : ''} (${rDurationM} min)`
    : 'Invalid (End must be after Start)';

  const handleRescheduleQuickDuration = (minutes) => {
    const sM = time24ToMinutes(rescheduleFormData.newStartTime) || 10 * 60;
    const eM = sM + minutes;
    const newEnd = minutesToTime24(eM);
    setRescheduleFormData(prev => ({
      ...prev,
      newEndTime: newEnd,
      newTime: formatTimeSlot(prev.newStartTime, newEnd)
    }));
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.date || !formData.course) return;

    const selectedCourseObj = (courses || []).find(c => c.title === formData.course);
    const isTrainerCourse = selectedCourseObj?.audience === 'trainer' || activeScheduleTab === 'trainer';

    let matchedTrainerObj = null;
    let selectedBatchObj = null;

    if (!isTrainerCourse) {
      if (!formData.batch) {
        showError('Please select a batch for this session.', 'Batch Required');
        return;
      }
      if (!formData.trainer) {
        showError('Please select a trainer for this session.', 'Trainer Required');
        return;
      }

      selectedBatchObj = (batchesList || []).find(b => b.name === formData.batch && (b.courseName === formData.course || !formData.course));
      const bTrainers = getBatchTrainers(selectedBatchObj, trainers);
      if (bTrainers.length === 0) {
        showError('This batch has no trainers assigned. Batches cannot be scheduled without an assigned trainer. Please assign a trainer in Batch Management first.', 'Cannot Schedule Session');
        return;
      }

      matchedTrainerObj = bTrainers.find(t => t.name === formData.trainer || t.id === formData.trainer);
      if (!matchedTrainerObj && bTrainers.length > 0) {
        showError('Selected trainer is not assigned to this batch. Please select an assigned batch trainer.', 'Invalid Trainer');
        return;
      }
    }

    // 1. Date not in past
    if (formData.date < todayStr) {
      showError('Schedule date cannot be in the past.', 'Invalid Date');
      return;
    }

    // 2. End time after start time
    const sM = time24ToMinutes(formData.startTime);
    const eM = time24ToMinutes(formData.endTime);
    if (eM <= sM) {
      showError('End time must be after start time.', 'Invalid Time');
      return;
    }

    // 3. Minimum 15 minutes
    const dur = eM - sM;
    if (dur < 15) {
      showError('Session duration must be at least 15 minutes.', 'Duration Too Short');
      return;
    }

    // 4. Maximum 4 hours (240 min)
    if (dur > 240) {
      showError('Session duration cannot exceed 4 hours (240 minutes).', 'Duration Too Long');
      return;
    }

    // 5. Warning if above 3 hours
    if (dur > 180) {
      const confirmLong = await confirm({
        title: 'Long Session Duration',
        message: `This session duration is ${Math.floor(dur / 60)}h ${dur % 60}m (over 3 hours). Are you sure you want to proceed?`,
        confirmText: 'Proceed'
      });
      if (!confirmLong) return;
    }

    const formattedTime = formatTimeSlot(formData.startTime, formData.endTime);
    const payload = isTrainerCourse ? {
      ...formData,
      courseId: selectedCourseObj?.id || formData.courseId || '',
      audience: 'TRAINER',
      batch: null,
      batchId: null,
      trainer: 'Admin',
      trainerId: null,
      meetLink: selectedCourseObj?.googleMeetUrl || '',
      time: formattedTime,
      notesFileUrl: formData.notesFile?.fileUrl || null,
      notesFileName: formData.notesFile?.name || null,
      worksheetFileUrl: formData.worksheetFile?.fileUrl || null,
      worksheetFileName: formData.worksheetFile?.name || null,
      assignmentFileUrl: formData.assignmentFile?.fileUrl || null,
      assignmentFileName: formData.assignmentFile?.name || null
    } : {
      ...formData,
      courseId: selectedCourseObj?.id || formData.courseId || '',
      audience: 'STUDENT',
      trainer: matchedTrainerObj?.name || formData.trainer,
      trainerId: matchedTrainerObj?.id || '',
      batchId: selectedBatchObj?.id || '',
      time: formattedTime,
      notesFileUrl: formData.notesFile?.fileUrl || null,
      notesFileName: formData.notesFile?.name || null,
      worksheetFileUrl: formData.worksheetFile?.fileUrl || null,
      worksheetFileName: formData.worksheetFile?.name || null,
      assignmentFileUrl: formData.assignmentFile?.fileUrl || null,
      assignmentFileName: formData.assignmentFile?.name || null
    };

    const targetDesc = isTrainerCourse ? `Trainer Course: ${formData.course}` : formData.batch;

    try {
      if (editingSchedule) {
        const res = await updateSchedule(editingSchedule.id, payload);
        if (res && res.success) {
          logActivity('Schedule Updated', `Updated session "${formData.title}" for ${targetDesc}`, 'Schedule');
          await showSuccess(res.message || `Session "${formData.title}" updated successfully.`, 'Schedule Updated');
        } else {
          await showError(res?.message || 'Failed to update schedule', 'Update Failed');
          return;
        }
      } else {
        const res = await createSchedule({
          ...payload,
          originalDate: formData.date,
          originalTime: formattedTime
        });

        if (res?.success) {
          logActivity('Schedule Created', `Scheduled session "${formData.title}" for ${targetDesc} on ${formData.date} (${formattedTime})`, 'Schedule');
          await notifyScheduleCreated(res.data || payload);
          await showSuccess(`Session "${formData.title}" created for ${targetDesc}. Automatic notifications dispatched.`, 'Schedule Created');
        } else {
          await showError(res?.message || 'Failed to create schedule', 'Creation Failed');
          return;
        }
      }

      await loadSchedules();
      setShowAddModal(false);
      setEditingSchedule(null);

      const liveCourses = (courses || []).filter(c => c.mode === 'Online' || c.mode === 'Hybrid' || !c.mode);
      const firstCourse = liveCourses[0]?.title || 'English Communication';
      const matchingBatches = (batchesList || []).filter(b => b.courseName === firstCourse && b.status === 'Active');
      const defBatch = matchingBatches[0];
      const defTrainers = getBatchTrainers(defBatch, trainers);
      const defTrainer = defTrainers.length === 1 ? defTrainers[0].name : '';

      setFormData({
        title: '',
        course: firstCourse,
        batch: defBatch?.name || '',
        trainer: defTrainer,
        startTime: '17:00',
        endTime: '18:00',
        time: '05:00 PM - 06:00 PM',
        date: todayStr,
        notesFile: null,
        worksheetFile: null,
        assignmentFile: null
      });
      setFileErrors({});
    } catch (err) {
      console.error('Failed to save schedule:', err);
      const msg = err.response?.data?.message || err?.message || 'Failed to save schedule';
      const isConflict = err.response?.status === 409 || msg.toLowerCase().includes('overlap');
      await showError(msg, isConflict ? 'Schedule Overlap Conflict' : 'Save Error');
    }
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleItem) return;

    if (rescheduleFormData.newDate < todayStr) {
      showError('New schedule date cannot be in the past.', 'Invalid Date');
      return;
    }

    const rsM = time24ToMinutes(rescheduleFormData.newStartTime);
    const reM = time24ToMinutes(rescheduleFormData.newEndTime);
    if (reM <= rsM) {
      showError('End time must be after start time.', 'Invalid Time');
      return;
    }

    const rdur = reM - rsM;
    if (rdur < 15) {
      showError('Session duration must be at least 15 minutes.', 'Duration Too Short');
      return;
    }
    if (rdur > 240) {
      showError('Session duration cannot exceed 4 hours (240 minutes).', 'Duration Too Long');
      return;
    }
    if (rdur > 180) {
      const confirmLong = await confirm({
        title: 'Long Session Duration',
        message: `This session duration is ${Math.floor(rdur / 60)}h ${rdur % 60}m (over 3 hours). Are you sure you want to proceed?`,
        confirmText: 'Proceed'
      });
      if (!confirmLong) return;
    }

    const originalDate = rescheduleItem.originalDate || rescheduleItem.date;
    const originalTime = rescheduleItem.originalTime || rescheduleItem.time;
    const formattedRescheduleTime = formatTimeSlot(rescheduleFormData.newStartTime, rescheduleFormData.newEndTime);

    const updatedPayload = {
      status: 'Rescheduled',
      originalDate,
      originalTime,
      date: rescheduleFormData.newDate,
      startTime: rescheduleFormData.newStartTime,
      endTime: rescheduleFormData.newEndTime,
      time: formattedRescheduleTime,
      rescheduledDate: rescheduleFormData.newDate,
      rescheduledTime: formattedRescheduleTime
    };

    try {
      const res = await updateSchedule(rescheduleItem.id, updatedPayload);
      if (res && res.success) {
        await notifyScheduleChange(
          rescheduleItem, 
          'Rescheduled', 
          originalDate, 
          originalTime, 
          rescheduleFormData.newDate, 
          formattedRescheduleTime
        );

        logActivity('Schedule Rescheduled', `Rescheduled "${rescheduleItem.title}" (${rescheduleItem.batch}) from ${originalDate} ${originalTime} to ${rescheduleFormData.newDate} ${formattedRescheduleTime}`, 'Schedule');

        await showSuccess(`${rescheduleItem.batch} (${rescheduleItem.course}) updated to ${rescheduleFormData.newDate} at ${formattedRescheduleTime}. Affected trainer and students notified.`, 'Session Rescheduled');

        setRescheduleItem(null);
        loadSchedules();
      } else {
        await showError(res?.message || 'Failed to reschedule session', 'Reschedule Failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err?.message || 'Failed to reschedule session';
      const isConflict = err.response?.status === 409 || msg.toLowerCase().includes('overlap');
      await showError(msg, isConflict ? 'Schedule Overlap Conflict' : 'Reschedule Failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const itemToDelete = (schedules || []).find(s => s.id === deleteId);
      const res = await deleteSchedule(deleteId);
      setDeleteId(null);
      if (res && res.success) {
        if (itemToDelete) {
          logActivity('Schedule Deleted', `Deleted scheduled session "${itemToDelete.title}" for ${itemToDelete.batch}`, 'Schedule');
        }
        await showSuccess(res.message || 'Schedule deleted successfully', 'Schedule Deleted');
        await loadSchedules();
      } else {
        await showError(res?.message || 'Failed to delete schedule', 'Delete Failed');
      }
    } catch (err) {
      setDeleteId(null);
      await showError(err?.message || 'Failed to delete schedule', 'Delete Failed');
    }
  };

  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTrainers = Array.isArray(trainers) ? trainers : [];
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeBatches = Array.isArray(batchesList) ? batchesList : [];

  // Filter out Recorded courses from schedule management dropdown
  const liveCourses = safeCourses.filter(c => c.mode === 'Online' || c.mode === 'Hybrid' || !c.mode);
  const studentLiveCourses = liveCourses.filter(c => c.audience !== 'trainer');
  const trainerLiveCourses = liveCourses.filter(c => c.audience === 'trainer');

  const isTrainerSchedule = (s) => {
    if (!s) return false;
    if (s.audience === 'TRAINER') return true;
    const crs = safeCourses.find(c => c.id === s.courseId || c.title === s.course);
    return crs?.audience === 'trainer';
  };

  const studentSchedules = safeSchedules.filter(s => !isTrainerSchedule(s));
  const trainerSchedules = safeSchedules.filter(s => isTrainerSchedule(s));
  const currentTabSchedules = activeScheduleTab === 'trainer' ? trainerSchedules : studentSchedules;

  const filteredSchedules = currentTabSchedules.filter(item => {
    if (!item) return false;
    const matchesDate = !selectedDateFilter || item.date === selectedDateFilter;
    const matchesSearch = !searchScheduleTitle || (item.title && item.title.toLowerCase().includes(searchScheduleTitle.toLowerCase()));

    if (activeScheduleTab === 'trainer') {
      const matchesCourse = selectedTrainerCourseFilter === 'All' 
        || item.courseId === selectedTrainerCourseFilter 
        || item.course === selectedTrainerCourseFilter;
      return matchesDate && matchesCourse && matchesSearch;
    } else {
      const matchesBatch = selectedBatchFilter === 'All' || item.batchId === selectedBatchFilter || item.batch === selectedBatchFilter;
      const matchesTrainer = selectedTrainerFilter === 'All' || 
        (item.trainer && item.trainer.toLowerCase().includes(selectedTrainerFilter.toLowerCase()));
      return matchesDate && matchesBatch && matchesTrainer && matchesSearch;
    }
  });

  const upcomingCount = currentTabSchedules.filter(s => s && s.status === 'Upcoming').length;
  const rescheduledCount = currentTabSchedules.filter(s => s && s.status === 'Rescheduled').length;
  const completedCount = currentTabSchedules.filter(s => s && s.status === 'Completed').length;

  const availableBatchesForSelectedCourse = safeBatches.filter(b => b.courseName === formData.course && b.status === 'Active');
  const selectedBatchObj = safeBatches.find(b => b.name === formData.batch && (b.courseName === formData.course || !formData.course));
  const currentBatchTrainers = getBatchTrainers(selectedBatchObj, safeTrainers);

  const selectedCourseObj = safeCourses.find(c => c.title === formData.course);
  const isTrainerCourse = selectedCourseObj?.audience === 'trainer' || (activeScheduleTab === 'trainer' && !selectedCourseObj);

  const handleOpenAddModal = () => {
    setEditingSchedule(null);
    const targetCourses = activeScheduleTab === 'trainer' ? trainerLiveCourses : studentLiveCourses;
    const firstCourseObj = targetCourses[0] || liveCourses[0];
    const firstCourse = firstCourseObj?.title || '';
    const isTrainer = activeScheduleTab === 'trainer' || firstCourseObj?.audience === 'trainer';

    let defaultBatch = '';
    let defaultTrainer = '';
    if (!isTrainer) {
      const courseBatches = safeBatches.filter(b => b.courseName === firstCourse && b.status === 'Active');
      defaultBatch = courseBatches[0]?.name || '';
      const bTrainers = getBatchTrainers(courseBatches[0], safeTrainers);
      defaultTrainer = bTrainers.length === 1 ? bTrainers[0].name : '';
    } else {
      defaultTrainer = 'Admin';
    }

    setFormData({
      title: '',
      course: firstCourse,
      batch: defaultBatch,
      trainer: defaultTrainer,
      startTime: '17:00',
      endTime: '18:00',
      time: '05:00 PM - 06:00 PM',
      date: todayStr,
      notesFile: null,
      worksheetFile: null,
      assignmentFile: null
    });
    setFileErrors({});
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6 bg-slate-50 min-h-screen p-6 sm:p-8">
      
      {/* Toast Alert */}
      {notifToast && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between font-medium text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-200" />
            <div>
              <strong className="block font-bold">{notifToast.title}</strong>
              <span>{notifToast.message}</span>
            </div>
          </div>
          <button onClick={() => setNotifToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Master Schedule Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Manage live class timetables for student batches and trainer-audience courses with automatic notifications.</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-[#0F52BA] hover:bg-blue-700 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md flex items-center space-x-2 text-xs sm:text-sm self-start sm:self-auto cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{activeScheduleTab === 'trainer' ? 'Schedule Trainer Session' : 'Add New Schedule'}</span>
        </button>
      </div>

      {/* Switch Tabs: Students Schedules vs Trainers Schedules */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveScheduleTab('student');
            setSelectedDateFilter('');
            setSelectedBatchFilter('All');
            setSelectedTrainerFilter('All');
            setSearchScheduleTitle('');
          }}
          className={`px-5 py-3 font-black text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeScheduleTab === 'student'
              ? 'border-[#0F52BA] text-[#0F52BA] bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students Schedules</span>
          <span className={`ml-1.5 px-2 py-0.5 text-[11px] rounded-full font-bold ${
            activeScheduleTab === 'student' ? 'bg-blue-100 text-[#0F52BA]' : 'bg-slate-200 text-slate-600'
          }`}>
            {studentSchedules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveScheduleTab('trainer');
            setSelectedDateFilter('');
            setSelectedTrainerCourseFilter('All');
            setSearchScheduleTitle('');
          }}
          className={`px-5 py-3 font-black text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeScheduleTab === 'trainer'
              ? 'border-[#0F52BA] text-[#0F52BA] bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Trainers Schedules</span>
          <span className={`ml-1.5 px-2 py-0.5 text-[11px] rounded-full font-bold ${
            activeScheduleTab === 'trainer' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {trainerSchedules.length}
          </span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Total Sessions</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{currentTabSchedules.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">Upcoming</div>
          <div className="text-2xl font-black text-[#0F52BA] mt-1">{upcomingCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-amber-600 font-semibold">Rescheduled</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{rescheduledCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-semibold">Completed</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Error Alert if data load failed */}
      {loadError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button onClick={loadSchedules} className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto text-xs">
          
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Search Topic</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search session title..."
                value={searchScheduleTitle}
                onChange={(e) => setSearchScheduleTitle(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Date</label>
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
            />
          </div>

          {activeScheduleTab === 'student' ? (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Batch</label>
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="All">All Batches</option>
                  {safeBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.courseName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Trainer</label>
                <select
                  value={selectedTrainerFilter}
                  onChange={(e) => setSelectedTrainerFilter(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="All">All Trainers</option>
                  {safeTrainers.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Trainer Course</label>
              <select
                value={selectedTrainerCourseFilter}
                onChange={(e) => setSelectedTrainerCourseFilter(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                <option value="All">All Trainer Courses</option>
                {trainerLiveCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}

          {(selectedDateFilter || searchScheduleTitle || (activeScheduleTab === 'student' && (selectedBatchFilter !== 'All' || selectedTrainerFilter !== 'All')) || (activeScheduleTab === 'trainer' && selectedTrainerCourseFilter !== 'All')) && (
            <button
              onClick={() => {
                setSelectedDateFilter('');
                setSelectedBatchFilter('All');
                setSelectedTrainerFilter('All');
                setSelectedTrainerCourseFilter('All');
                setSearchScheduleTitle('');
              }}
              className="mt-4 px-2.5 py-1 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg font-bold text-[10px] cursor-pointer"
            >
              Clear Filters
            </button>
          )}

        </div>
      </div>

      {/* Timetable Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Session & Course</th>
                <th className="py-3.5 px-4">Schedule Date</th>
                <th className="py-3.5 px-4">{activeScheduleTab === 'trainer' ? 'Target Audience' : 'Batch'}</th>
                <th className="py-3.5 px-4">{activeScheduleTab === 'trainer' ? 'Conductor' : 'Assigned Trainer'}</th>
                <th className="py-3.5 px-4">Time Slot</th>
                <th className="py-3.5 px-4">Attachments</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400 font-bold whitespace-normal">
                    Loading schedules...
                  </td>
                </tr>
              ) : filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400 font-bold whitespace-normal">
                    No schedules available.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((item) => {
                  const isRescheduled = item.status === 'Rescheduled';
                  const hasNotes = Boolean(item.notesFile);
                  const hasWorksheet = Boolean(item.worksheetFile);
                  const hasAssignment = Boolean(item.assignmentFile);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-black text-slate-900 text-sm">{item.title || 'Untitled Session'}</div>
                          {!isValidGoogleMeetUrl(item.meetLink || item.googleMeetUrl || item.meetUrl) && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold" title="Meeting link not set or invalid">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Link Missing</span>
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                          <span>{item.course || 'English Communication'}</span>
                          {activeScheduleTab === 'trainer' && (
                            <span className="inline-flex items-center text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                              Trainer Course
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {item.date || todayStr}
                      </td>
                      <td className="py-4 px-4 font-bold">
                        {activeScheduleTab === 'trainer' ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                            <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                            <span>{item.studentsCount ?? 'All'} Enrolled Trainers</span>
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-[#0F52BA] border border-blue-200 px-2.5 py-1 rounded-lg font-bold">
                            {item.batch || 'Unassigned'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-800">
                        {activeScheduleTab === 'trainer' ? (
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <User className="w-3.5 h-3.5 text-purple-600" />
                            <span>Admin (Conductor)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {item.trainer || 'Unassigned'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-700 font-mono font-bold">{item.time || '10:00 AM - 11:00 AM'}</td>
                      
                      {/* Attachments Column */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1.5 text-[10px] font-bold">
                          {hasNotes && (
                            <div className="flex items-center justify-between gap-1.5 bg-emerald-50 text-emerald-800 px-2 py-1 rounded-lg border border-emerald-200">
                              <span className="truncate max-w-[100px]" title={item.notesFile.name}>📄 {item.notesFile.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setViewerFile(item.notesFile)}
                                  className="p-1 hover:bg-emerald-200 rounded text-emerald-900 cursor-pointer"
                                  title="View Attachment"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <label className="p-1 hover:bg-emerald-200 rounded text-emerald-900 cursor-pointer" title="Re-upload / Replace File">
                                  <Upload className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) handleReuploadScheduleFile(item, 'notesFile', e.target.files[0]);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                          {hasWorksheet && (
                            <div className="flex items-center justify-between gap-1.5 bg-blue-50 text-blue-800 px-2 py-1 rounded-lg border border-blue-200">
                              <span className="truncate max-w-[100px]" title={item.worksheetFile.name}>📑 {item.worksheetFile.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setViewerFile(item.worksheetFile)}
                                  className="p-1 hover:bg-blue-200 rounded text-blue-900 cursor-pointer"
                                  title="View Attachment"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <label className="p-1 hover:bg-blue-200 rounded text-blue-900 cursor-pointer" title="Re-upload / Replace File">
                                  <Upload className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) handleReuploadScheduleFile(item, 'worksheetFile', e.target.files[0]);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                          {hasAssignment && (
                            <div className="flex items-center justify-between gap-1.5 bg-purple-50 text-purple-800 px-2 py-1 rounded-lg border border-purple-200">
                              <span className="truncate max-w-[100px]" title={item.assignmentFile.name}>📝 {item.assignmentFile.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setViewerFile(item.assignmentFile)}
                                  className="p-1 hover:bg-purple-200 rounded text-purple-900 cursor-pointer"
                                  title="View Attachment"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <label className="p-1 hover:bg-purple-200 rounded text-purple-900 cursor-pointer" title="Re-upload / Replace File">
                                  <Upload className="w-3.5 h-3.5" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) handleReuploadScheduleFile(item, 'assignmentFile', e.target.files[0]);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}

                          {!hasNotes && !hasWorksheet && !hasAssignment && (
                            <span className="text-slate-400 italic font-medium">None</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 space-y-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isRescheduled
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {item.status || 'Upcoming'}
                        </span>

                        {isRescheduled && (item.originalDate || item.originalTime) && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Orig: {item.originalDate} ({item.originalTime})
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right space-x-1.5">
                        
                        {/* Edit Action Button */}
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2.5 py-1 bg-blue-50 text-[#0F52BA] hover:bg-blue-100 border border-blue-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          title="Edit Schedule"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* Reschedule Action Button */}
                        <button
                          onClick={() => {
                            const parsed = parseSlotTo24(item.time || item.startTime);
                            const st = item.startTime || parsed.start;
                            const et = item.endTime || parsed.end;
                            setRescheduleItem(item);
                            setRescheduleFormData({
                              newDate: item.date || todayStr,
                              newStartTime: st,
                              newEndTime: et,
                              newTime: item.time || formatTimeSlot(st, et)
                            });
                          }}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          title="Reschedule Session"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-4 text-xs max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingSchedule(null);
              }}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-slate-900">{editingSchedule ? 'Edit Scheduled Session' : 'Schedule New Session'}</h3>

            <form onSubmit={handleAddSchedule} className="space-y-3.5">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Schedule Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Topic / Session Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Present Continuous Tense"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isTrainerCourse ? 'Trainer Course (Online & Hybrid Only) *' : 'Course (Online & Hybrid Only) *'}
                </label>
                <select
                  value={formData.course}
                  onChange={(e) => handleCourseChangeInForm(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                >
                  {(activeScheduleTab === 'trainer' ? (trainerLiveCourses.length > 0 ? trainerLiveCourses : liveCourses) : (studentLiveCourses.length > 0 ? studentLiveCourses : liveCourses)).map((c) => (
                    <option key={c.id} value={c.title}>{c.title} ({c.mode || 'Online'})</option>
                  ))}
                </select>
              </div>

              {/* Batch & Batch Trainer - Only shown for student-audience courses */}
              {!isTrainerCourse ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Batch (Course-Filtered) *</label>
                    <select
                      value={formData.batch}
                      onChange={(e) => handleBatchChangeInForm(e.target.value)}
                      disabled={availableBatchesForSelectedCourse.length === 0}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                    >
                      {availableBatchesForSelectedCourse.length > 0 ? (
                        availableBatchesForSelectedCourse.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))
                      ) : (
                        <option value="">No batches for this course</option>
                      )}
                    </select>
                    {availableBatchesForSelectedCourse.length === 0 && (
                      <p className="text-[10px] text-amber-600 font-bold mt-1">No active batches available for this course.</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Batch Trainer *</label>
                    {currentBatchTrainers.length === 0 ? (
                      <div>
                        <input
                          type="text"
                          readOnly
                          value="No trainer assigned to this batch"
                          className="w-full px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-semibold text-xs cursor-not-allowed"
                        />
                        <p className="text-[10px] text-rose-600 font-bold mt-1">
                          ⚠️ This batch has no trainers assigned. Batches cannot be scheduled without an assigned trainer.
                        </p>
                      </div>
                    ) : currentBatchTrainers.length === 1 ? (
                      <div>
                        <input
                          type="text"
                          readOnly
                          value={formData.trainer || currentBatchTrainers[0].name}
                          className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-extrabold text-blue-900 cursor-not-allowed"
                          title="Sole trainer assigned to this batch"
                        />
                        <p className="text-[9px] text-slate-500 font-medium mt-1">
                          ✓ Assigned batch trainer: {currentBatchTrainers[0].name}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <select
                          required
                          value={formData.trainer}
                          onChange={(e) => setFormData(prev => ({ ...prev, trainer: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-blue-600"
                        >
                          <option value="">-- Select Batch Trainer --</option>
                          {currentBatchTrainers.map(t => (
                            <option key={t.id || t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-indigo-600 font-bold mt-1">
                          👥 Select which of the {currentBatchTrainers.length} batch trainers conducts this session
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs font-semibold flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Trainer-audience course: Conducted by Admin for all enrolled trainers. Google Meet link will be automatically fetched from course settings.</span>
                </div>
              )}

              {/* START TIME & END TIME INPUTS WITH DURATION PREVIEW & QUICK BUTTONS */}
              <div className="space-y-2.5 p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const sM = time24ToMinutes(newStart);
                        const eM = time24ToMinutes(formData.endTime);
                        let updatedEnd = formData.endTime;
                        if (eM <= sM) {
                          updatedEnd = minutesToTime24(sM + 60);
                        }
                        setFormData(prev => ({
                          ...prev,
                          startTime: newStart,
                          endTime: updatedEnd,
                          time: formatTimeSlot(newStart, updatedEnd)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">End Time *</label>
                    <input
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          endTime: newEnd,
                          time: formatTimeSlot(prev.startTime, newEnd)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-blue-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-500">Duration:</span>
                    <span className={`px-2 py-0.5 rounded-lg font-black ${
                      durationM >= 15 && durationM <= 240
                        ? durationM > 180 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {durationPreview}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Quick:</span>
                    {[30, 45, 60, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleQuickDuration(m)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400">
                  Formatted slot: <span className="font-bold text-slate-700">{formData.time}</span>
                </div>
              </div>



              {/* CLASS RESOURCE ATTACHMENTS (Notes, Worksheet, Assignment) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 pt-3">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center justify-between">
                  <span>Class Resource Attachments (Optional)</span>
                  <span className="text-[10px] text-slate-400 font-semibold">All formats supported (Max 100 MB)</span>
                </h4>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Notes File</label>
                  {formData.notesFile ? (
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs font-bold">
                      <span className="truncate max-w-[180px]" title={formData.notesFile.name}>📄 {formData.notesFile.name} ({formData.notesFile.size})</span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewerFile(formData.notesFile)}
                          className="px-2 py-1 bg-blue-50 text-[#0F52BA] hover:bg-blue-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'notesFile')}
                          />
                        </label>
                        <button type="button" onClick={() => setFormData({ ...formData, notesFile: null })} className="text-rose-600 font-bold hover:underline text-[11px]">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <input type="file" onChange={(e) => handleFileUpload(e, 'notesFile')} className="w-full text-xs font-medium cursor-pointer" />
                  )}
                  {fileErrors.notesFile && <p className="text-[10px] font-bold text-rose-600">{fileErrors.notesFile}</p>}
                </div>

                {/* Worksheet */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Worksheet File</label>
                  {formData.worksheetFile ? (
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs font-bold">
                      <span className="truncate max-w-[180px]" title={formData.worksheetFile.name}>📑 {formData.worksheetFile.name} ({formData.worksheetFile.size})</span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewerFile(formData.worksheetFile)}
                          className="px-2 py-1 bg-blue-50 text-[#0F52BA] hover:bg-blue-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'worksheetFile')}
                          />
                        </label>
                        <button type="button" onClick={() => setFormData({ ...formData, worksheetFile: null })} className="text-rose-600 font-bold hover:underline text-[11px]">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <input type="file" onChange={(e) => handleFileUpload(e, 'worksheetFile')} className="w-full text-xs font-medium cursor-pointer" />
                  )}
                  {fileErrors.worksheetFile && <p className="text-[10px] font-bold text-rose-600">{fileErrors.worksheetFile}</p>}
                </div>

                {/* Assignment */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">Assignment File</label>
                  {formData.assignmentFile ? (
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs font-bold">
                      <span className="truncate max-w-[180px]" title={formData.assignmentFile.name}>📝 {formData.assignmentFile.name} ({formData.assignmentFile.size})</span>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewerFile(formData.assignmentFile)}
                          className="px-2 py-1 bg-blue-50 text-[#0F52BA] hover:bg-blue-100 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'assignmentFile')}
                          />
                        </label>
                        <button type="button" onClick={() => setFormData({ ...formData, assignmentFile: null })} className="text-rose-600 font-bold hover:underline text-[11px]">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <input type="file" onChange={(e) => handleFileUpload(e, 'assignmentFile')} className="w-full text-xs font-medium cursor-pointer" />
                  )}
                  {fileErrors.assignmentFile && <p className="text-[10px] font-bold text-rose-600">{fileErrors.assignmentFile}</p>}
                </div>
              </div>

              {!isTrainerCourse && currentBatchTrainers.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-semibold">
                  ⚠️ This batch has no assigned trainers. Batches cannot be scheduled without an assigned trainer. Please assign a trainer in Batch Management.
                </div>
              )}

              <button
                type="submit"
                disabled={isTrainerCourse ? (!formData.title?.trim() || !formData.date || !formData.course) : (!formData.batch || currentBatchTrainers.length === 0 || !formData.trainer)}
                className="w-full bg-[#0F52BA] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl shadow-md transition-colors text-xs mt-3 cursor-pointer"
              >
                {editingSchedule ? 'Update Schedule & Notify' : (isTrainerCourse ? 'Schedule & Auto-Notify Enrolled Trainers' : 'Schedule & Auto-Notify Trainer & Batch')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 text-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setRescheduleItem(null)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 text-amber-600">
              <RefreshCw className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-lg font-black text-slate-900">Reschedule Session</h3>
                <p className="text-slate-500 text-[11px] font-medium">{rescheduleItem.title} ({rescheduleItem.batch})</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-900 font-semibold space-y-1">
              <div><strong>Original Schedule:</strong> {rescheduleItem.date || rescheduleItem.originalDate} ({rescheduleItem.time || rescheduleItem.originalTime})</div>
              <div><strong>Batch Trainer:</strong> {rescheduleItem.trainer}</div>
              <p className="text-[10px] text-amber-700 italic pt-1">
                Note: Rescheduling overrides this specific session instance and dispatches in-app notifications.
              </p>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Schedule Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleFormData.newDate}
                  onChange={(e) => setRescheduleFormData({ ...rescheduleFormData, newDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                />
              </div>

              {/* START TIME & END TIME INPUTS WITH DURATION PREVIEW & QUICK BUTTONS */}
              <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">New Start Time *</label>
                    <input
                      type="time"
                      required
                      value={rescheduleFormData.newStartTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const sM = time24ToMinutes(newStart);
                        const eM = time24ToMinutes(rescheduleFormData.newEndTime);
                        let updatedEnd = rescheduleFormData.newEndTime;
                        if (eM <= sM) {
                          updatedEnd = minutesToTime24(sM + 60);
                        }
                        setRescheduleFormData(prev => ({
                          ...prev,
                          newStartTime: newStart,
                          newEndTime: updatedEnd,
                          newTime: formatTimeSlot(newStart, updatedEnd)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">New End Time *</label>
                    <input
                      type="time"
                      required
                      value={rescheduleFormData.newEndTime}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setRescheduleFormData(prev => ({
                          ...prev,
                          newEndTime: newEnd,
                          newTime: formatTimeSlot(prev.newStartTime, newEnd)
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-blue-600"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-500">Duration:</span>
                    <span className={`px-2 py-0.5 rounded-lg font-black ${
                      rDurationM >= 15 && rDurationM <= 240
                        ? rDurationM > 180 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {rDurationPreview}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Quick:</span>
                    {[30, 45, 60, 90].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleRescheduleQuickDuration(m)}
                        className="px-2 py-1 bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400">
                  New slot: <span className="font-bold text-slate-700">{rescheduleFormData.newTime}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-3 rounded-xl shadow-md text-xs mt-2 cursor-pointer"
              >
                Confirm Reschedule & Notify Batch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message="Are you sure you want to cancel and delete this scheduled session?"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Universal File Viewer Modal */}
      <UniversalFileViewerModal
        isOpen={Boolean(viewerFile)}
        onClose={() => setViewerFile(null)}
        file={viewerFile}
        hideDownload={true}
      />

    </div>
  );
}

