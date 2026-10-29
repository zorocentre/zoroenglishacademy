import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Video, Layers } from 'lucide-react';
import { getCourseById, updateCourse } from '../../api/courseApi';
import { getTrainers } from '../../api/userApi';
import FileUploader from '../common/FileUploader';
import MoneyInput from '../common/MoneyInput';
import { resolveFileUrl } from '../../api/fileApi';
import { useDialog } from '../../context/DialogContext';
import { normalizeGoogleMeetUrl, isValidGoogleMeetUrl } from '../../utils/scheduleSortUtil';
import PageLoader from '../common/PageLoader';
import ButtonSpinner from '../common/ButtonSpinner';

export default function EditCoursePage({ courseId: propCourseId, setActiveScreen }) {
  const { showSuccess, showError } = useDialog();
  const { courseId: paramCourseId } = useParams();
  const navigate = useNavigate();
  const courseId = propCourseId || paramCourseId;
  const [formData, setFormData] = useState(null);
  const [trainersList, setTrainersList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (courseId) {
      Promise.all([
        getCourseById(courseId),
        getTrainers()
      ]).then(([cRes, tRes]) => {
        const trainers = tRes.data || [];
        setTrainersList(trainers);

        if (cRes.data) {
          const c = cRes.data;
          const matchedTrainer = trainers.find(t => t.id === c.trainerId || (c.assignedTrainer && t.name?.toLowerCase().trim() === c.assignedTrainer?.toLowerCase().trim()));
          setFormData({
            title: '',
            description: '',
            duration: '3 Months',
            mode: 'Online',
            trainerId: c.trainerId || matchedTrainer?.id || '',
            assignedTrainer: c.assignedTrainer || matchedTrainer?.name || '',
            googleMeetUrl: '',
            youtubeUrl: '',
            overview: '',
            thumbnail: '',
            ...c,
            price: c.price != null && Number(c.price) > 0 ? String(c.price) : ''
          });
        }
      }).catch(err => {
        console.error('Failed to load course or trainers:', err);
      });
    }
  }, [courseId]);

  if (!formData) {
    return <PageLoader fullPage message="Loading course details..." />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    let normalizedMeetUrl = null;
    let trainerId = null;
    let assignedTrainer = null;

    if (formData.mode === 'Online' || formData.mode === 'Hybrid') {
      const rawMeet = formData.googleMeetUrl ? formData.googleMeetUrl.trim() : '';
      if (!rawMeet) {
        await showError(`Google Meet Link is required for ${formData.mode} courses.`, 'Validation Error: Google Meet Link');
        return;
      }
      normalizedMeetUrl = normalizeGoogleMeetUrl(rawMeet);
      if (!isValidGoogleMeetUrl(normalizedMeetUrl)) {
        await showError(`Invalid Google Meet Link: "${formData.googleMeetUrl}". Please enter a valid URL (e.g. https://meet.google.com/abc-defg-hij).`, 'Validation Error: Google Meet Link');
        return;
      }
      trainerId = null;
      assignedTrainer = null;
    } else {
      normalizedMeetUrl = null;
      // Recorded
      if (formData.audience === 'trainer') {
        trainerId = 'admin';
        assignedTrainer = 'Admin';
      } else {
        if (!formData.trainerId) {
          await showError('Trainer is required for Student Recorded courses.', 'Validation Error');
          return;
        }
        trainerId = formData.trainerId;
        assignedTrainer = formData.assignedTrainer;
      }
    }

    setSaving(true);
    try {
      const submitPrice = formData.price !== '' ? Number(formData.price) : 0;
      const res = await updateCourse(courseId, {
        ...formData,
        price: submitPrice,
        googleMeetUrl: normalizedMeetUrl,
        trainerId,
        assignedTrainer
      });
      setSaving(false);
      if (res && res.success) {
        await showSuccess(res.message || 'Course updated successfully', 'Course Updated');
        if (setActiveScreen) setActiveScreen('admin-manage-courses');
        navigate('/admin/courses');
      } else {
        await showError(res?.message || 'Failed to update course', 'Update Failed');
      }
    } catch (err) {
      setSaving(false);
      await showError(err?.message || 'Failed to update course', 'Update Failed');
    }
  };

  const isOnlineOrHybrid = formData.mode === 'Online' || formData.mode === 'Hybrid';
  const isRecordedOrHybrid = formData.mode === 'Recorded' || formData.mode === 'Hybrid';

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      <button
        onClick={() => {
          if (setActiveScreen) setActiveScreen('admin-manage-courses');
          navigate('/admin/courses');
        }}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Courses</span>
      </button>

      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Edit Course: {formData.title}</h1>
          <p className="text-xs text-slate-500 font-medium">Update course info, delivery mode (Online, Recorded, Hybrid), and live class settings.</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course Description *</label>
            <textarea
              rows={3}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duration Value *</label>
              <input
                type="number"
                min="1"
                required
                placeholder="3"
                value={formData.durationValue || (formData.duration ? formData.duration.split(' ')[0] : '3')}
                onChange={(e) => {
                  const val = e.target.value;
                  const unit = formData.durationUnit || (formData.duration ? formData.duration.split(' ')[1] : 'Months');
                  setFormData({ ...formData, durationValue: val, durationUnit: unit, duration: `${val} ${unit}` });
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duration Unit *</label>
              <select
                value={formData.durationUnit || (formData.duration && formData.duration.includes('Year') ? (formData.duration.includes('Years') ? 'Years' : 'Year') : (formData.duration && formData.duration.includes('Month') && !formData.duration.includes('Months') ? 'Month' : 'Months'))}
                onChange={(e) => {
                  const unit = e.target.value;
                  const val = formData.durationValue || (formData.duration ? formData.duration.split(' ')[0] : '3');
                  setFormData({ ...formData, durationUnit: unit, durationValue: val, duration: `${val} ${unit}` });
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white cursor-pointer"
              >
                <option value="Months">Months</option>
                <option value="Month">Month</option>
                <option value="Years">Years</option>
                <option value="Year">Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Course Fee (₹) *</label>
              <MoneyInput
                placeholder="e.g. 2500"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Course Mode *</label>
              <select
                value={formData.mode || 'Online'}
                onChange={(e) => {
                  const newMode = e.target.value;
                  const isTrainer = formData.audience === 'trainer';
                  setFormData({ 
                    ...formData, 
                    mode: newMode,
                    trainerId: newMode === 'Recorded' ? (isTrainer ? 'admin' : '') : '',
                    assignedTrainer: newMode === 'Recorded' ? (isTrainer ? 'Admin' : '') : ''
                  });
                }}
                className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-black text-blue-900 focus:bg-white focus:border-blue-600"
              >
                <option value="Online">Online (Live Sessions)</option>
                <option value="Recorded">Recorded (Modules & Videos)</option>
                <option value="Hybrid">Hybrid (Live + Recorded)</option>
              </select>
            </div>

            {/* REQUIREMENT: EDIT COURSE FOR (AUDIENCE) SELECTION */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Course For *</label>
              <select
                required
                value={formData.audience || 'student'}
                onChange={(e) => {
                  const newAudience = e.target.value;
                  setFormData({
                    ...formData,
                    audience: newAudience,
                    trainerId: formData.mode === 'Recorded' && newAudience === 'trainer' ? 'admin' : (formData.mode === 'Recorded' ? '' : formData.trainerId),
                    assignedTrainer: formData.mode === 'Recorded' && newAudience === 'trainer' ? 'Admin' : (formData.mode === 'Recorded' ? '' : formData.assignedTrainer)
                  });
                }}
                className="w-full px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-black text-purple-900 focus:bg-white focus:border-purple-600"
              >
                <option value="student">Student (Public & LMS)</option>
                <option value="trainer">Trainer (Trainer's Courses Only)</option>
              </select>
            </div>

            {isOnlineOrHybrid ? (
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold flex items-center gap-2">
                <span className="text-blue-600 font-bold">ℹ️</span>
                <span>Trainers are assigned per batch in <strong>Batch Management</strong>. Online & Hybrid courses do not have a course-level trainer.</span>
              </div>
            ) : formData.audience === 'trainer' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Trainer</label>
                <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                  Admin (Fixed for Trainer Courses)
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Trainer * (For Student Doubts & Reviews)
                </label>
                <select
                  required
                  value={formData.trainerId || ''}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const matched = trainersList.find(t => t.id === selId);
                    setFormData({
                      ...formData,
                      trainerId: selId,
                      assignedTrainer: matched ? matched.name : ''
                    });
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white"
                >
                  <option value="" disabled>Select Trainer...</option>
                  {trainersList.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.specialty ? `(${t.specialty})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* REQUIREMENT #2: ONLINE & HYBRID LIVE SESSION FIELDS */}
          {isOnlineOrHybrid && (
            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-4">
              <h3 className="text-xs font-black text-blue-900 flex items-center gap-2 uppercase tracking-wider">
                <Video className="w-4 h-4 text-blue-600" />
                Live Session Configuration ({formData.mode} Mode)
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Google Meet Link *</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={formData.googleMeetUrl || ''}
                  onChange={(e) => setFormData({ ...formData, googleMeetUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          )}

          {isRecordedOrHybrid && (
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-xs font-medium text-purple-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-purple-600 shrink-0" />
                <span>Recorded modules & private video uploads can be managed via <strong>"Course Modules"</strong> after saving.</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course Thumbnail Image</label>
            {formData.thumbnail && (
              <div className="mb-2 w-32 h-20 rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
                <img
                  src={resolveFileUrl(formData.thumbnail)}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/assets/course-placeholder.svg';
                  }}
                />
              </div>
            )}
            <FileUploader 
              label="Click to change course thumbnail image" 
              accept=".png,.jpg,.jpeg,.webp"
              category="thumbnail"
              onUploadComplete={(result) => {
                setFormData(prev => ({ ...prev, thumbnail: result.url }));
              }}
              onUploadingStateChange={(isUploading) => {
                setSaving(isUploading);
              }}
            />
          </div>

          <ButtonSpinner
            type="submit"
            loading={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center space-x-2 text-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Update Course</span>
          </ButtonSpinner>
        </form>
      </div>
    </div>
  );
}

