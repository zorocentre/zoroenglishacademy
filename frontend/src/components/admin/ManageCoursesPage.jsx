import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Edit, Layers, Trash2, User, Search } from 'lucide-react';
import { getCourses, deleteCourse, getCourseDeletionImpact } from '../../api/courseApi';
import ConfirmModal from '../common/ConfirmModal';
import SkeletonList from '../common/SkeletonList';
import { resolveFileUrl } from '../../api/fileApi';
import { useDialog } from '../../context/DialogContext';

const formatModulesDuration = (modules) => {
  if (!modules || modules.length === 0) return '';
  let totalSec = 0;
  let hasValid = false;
  for (const m of modules) {
    if (!m.duration) continue;
    const dur = m.duration.trim();
    if (/^\d+:\d+(:\d+)?$/.test(dur)) {
      const parts = dur.split(':').map(Number);
      if (parts.length === 2) {
        totalSec += parts[0] * 60 + parts[1];
        hasValid = true;
      } else if (parts.length === 3) {
        totalSec += parts[0] * 3600 + parts[1] * 60 + parts[2];
        hasValid = true;
      }
    } else {
      const hrs = dur.match(/(\d+)\s*(h|hr|hrs|hour|hours)/i);
      const mins = dur.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);
      if (hrs || mins) {
        if (hrs) totalSec += parseInt(hrs[1], 10) * 3600;
        if (mins) totalSec += parseInt(mins[1], 10) * 60;
        hasValid = true;
      }
    }
  }
  if (!hasValid || totalSec <= 0) return '';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m} mins`;
  return `${s}s`;
};

export default function ManageCoursesPage({ _setActiveScreen, setSelectedCourseIdForEdit }) {
  const { showSuccess, showError } = useDialog();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [deleteModalData, setDeleteModalData] = useState(null);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const cRes = await getCourses();
      setCourses(cRes.data || []);
    } catch (err) {
      console.error('Failed to load courses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleInitiateDeleteCourse = async (course) => {
    try {
      const impactRes = await getCourseDeletionImpact(course.id);
      if (impactRes && impactRes.data) {
        setDeleteModalData({
          id: course.id,
          title: course.title,
          mode: course.mode,
          counts: impactRes.data.counts || {},
          canDelete: impactRes.data.canDelete,
          blockingReasons: impactRes.data.blockingReasons || []
        });
      } else {
        setDeleteModalData({
          id: course.id,
          title: course.title,
          canDelete: true,
          blockingReasons: []
        });
      }
    } catch {
      setDeleteModalData({
        id: course.id,
        title: course.title,
        canDelete: true,
        blockingReasons: []
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteModalData) {
      try {
        const res = await deleteCourse(deleteModalData.id);
        setDeleteModalData(null);
        if (res && res.success) {
          await showSuccess(res.message || 'Course deleted successfully', 'Course Deleted');
          loadCourses();
        } else {
          await showError(res?.message || 'Failed to delete course', 'Delete Failed');
        }
      } catch (err) {
        setDeleteModalData(null);
        await showError(err?.message || 'Failed to delete course', 'Delete Failed');
      }
    }
  };

  const filteredCourses = courses.filter(course => {
    const courseAudience = course.audience || 'student';
    if (audienceFilter !== 'All' && courseAudience !== audienceFilter) {
      return false;
    }

    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;
    return (
      (course.title && course.title.toLowerCase().includes(query)) ||
      (course.id && course.id.toLowerCase().includes(query)) ||
      (course.description && course.description.toLowerCase().includes(query)) ||
      (course.assignedTrainer && course.assignedTrainer.toLowerCase().includes(query)) ||
      (course.mode && course.mode.toLowerCase().includes(query)) ||
      (course.duration && course.duration.toLowerCase().includes(query)) ||
      (course.price != null && String(course.price).includes(query))
    );
  });

  return (
    <div className="p-[#16px] sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Course Management</h1>
          <p className="text-xs text-slate-500 font-medium">Create, edit, delete, and assign trainers to Zoro English Academy courses.</p>
        </div>

        <button
          onClick={() => navigate('/admin/courses/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center space-x-2 text-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Course</span>
        </button>
      </div>

      {/* Search & Audience Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="🔍 Search courses by title, ID, trainer, fee, or duration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
        >
          <option value="All">All Audiences</option>
          <option value="student">Student Courses Only</option>
          <option value="trainer">Trainer Courses Only</option>
        </select>
      </div>

      {loading ? (
        <SkeletonList count={6} lines={3} />
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">No courses found</h3>
          <p className="text-xs text-slate-500 font-medium">No courses match your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const coursePrice = course.price != null && Number(course.price) > 0 ? Number(course.price) : 0;
            const isTrainerCourse = course.audience === 'trainer';
            return (
              <div key={course.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col justify-between group">
                <div>
                  <div className="relative h-44 bg-slate-900 overflow-hidden">
                    <img 
                      src={resolveFileUrl(course.thumbnail)} 
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/assets/course-placeholder.svg';
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 text-white text-[10px] font-black px-3 py-1 rounded-full shadow border border-slate-700">
                      {isTrainerCourse ? '🎓 For Trainers' : '👨‍🎓 For Students'}
                    </div>
                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow">
                      {course.mode}
                    </div>
                    <div className="absolute bottom-3 left-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-xl shadow flex items-center space-x-1">
                      <span>{coursePrice > 0 ? `₹${coursePrice.toLocaleString('en-IN')}` : 'Free'}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                      {course.duration || formatModulesDuration(course.modules) || 'Flexible Duration'}
                    </div>
                    <h3 className="text-xl font-black text-slate-900">{course.title}</h3>
                    <p className="text-slate-500 text-xs line-clamp-2">{course.description}</p>
                    
                    <div className="pt-2 text-xs font-bold text-slate-600 flex flex-wrap items-center gap-2">
                      {course.mode !== 'Online' ? (
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                          {(course.modules || []).length} {(course.modules || []).length === 1 ? 'Module' : 'Modules'}
                          {formatModulesDuration(course.modules) ? ` • ${formatModulesDuration(course.modules)}` : ''}
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
                          Live Sessions Only (No Modules)
                        </span>
                      )}
                      <span className="bg-[#0F52BA]/10 text-[#0F52BA] px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Trainer: {course.audience === 'trainer'
                          ? 'Admin'
                          : (course.mode === 'Recorded'
                              ? (course.assignedTrainer && course.assignedTrainer !== 'None (Self-Paced)' ? course.assignedTrainer : 'Instructor-Led')
                              : 'Assigned per batch')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-slate-100 mt-4">
                  {course.mode !== 'Online' ? (
                    <button
                      onClick={() => {
                        if (setSelectedCourseIdForEdit) setSelectedCourseIdForEdit(course.id);
                        navigate(`/admin/courses/${course.id}/content`);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Modules</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 italic">
                       Live Schedule Mode
                    </span>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        if (setSelectedCourseIdForEdit) setSelectedCourseIdForEdit(course.id);
                        navigate(`/admin/courses/${course.id}/edit`);
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleInitiateDeleteCourse(course)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center space-x-1 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteModalData)}
        title={deleteModalData?.canDelete ? "Delete Course" : "Cannot Delete Course"}
        message={
          !deleteModalData?.canDelete && deleteModalData?.blockingReasons?.length > 0
            ? deleteModalData.blockingReasons.join(' ')
            : deleteModalData?.mode?.toLowerCase() === 'recorded'
            ? `Are you sure you want to delete recorded course "${deleteModalData?.title}"? This will permanently delete the course along with all associated modules, video/storage files, enrolled students, batches, assignments, and doubts. This action cannot be undone.`
            : `Are you sure you want to delete course "${deleteModalData?.title}"? This action cannot be undone.`
        }
        confirmText="Delete Course"
        confirmDisabled={!deleteModalData?.canDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalData(null)}
      />

    </div>
  );
}

