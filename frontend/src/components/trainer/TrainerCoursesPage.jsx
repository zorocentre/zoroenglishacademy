import React, { useState, useEffect } from 'react';
import { BookOpen, Layers, Clock, CheckCircle2, UserCheck, Search, Send, Check, Download, ChevronDown, ChevronUp, Image as ImageIcon, FileText, Play } from 'lucide-react';
import { getMyTrainerCourses, createTrainerCourseRequest } from '../../api/courseApi';
import { resolveFileUrl, openFileWithSignedLink } from '../../api/fileApi';
import { useAuth } from '../../context/AuthContext';
import SafeImage from '../common/SafeImage';
import SkeletonList from '../common/SkeletonList';
import CourseLearningPage from '../student/CourseLearningPage';

function formatModulesDuration(modules) {
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
}

export default function TrainerCoursesPage() {
  const { user } = useAuth();
  const trainerId = user?.id || '';
  const trainerName = user?.name || '';
  const trainerEmail = user?.email || '';

  const [activeSubTab, setActiveSubTab] = useState('enrolled'); // 'enrolled' | 'available'
  const [trainerCoursesData, setTrainerCoursesData] = useState({ enrolled: [], pending: [], available: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [selectedCourseForClassroom, setSelectedCourseForClassroom] = useState(null);

  const loadTrainerCourses = async () => {
    setLoading(true);
    try {
      const res = await getMyTrainerCourses();
      if (res.success && res.data) {
        setTrainerCoursesData(res.data);
      }
    } catch (err) {
      console.error('Failed to load trainer courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrainerCourses();
  }, [trainerId, trainerEmail]);

  const enrolledCourses = trainerCoursesData.enrolled || [];
  const pendingCourses = trainerCoursesData.pending || [];
  const availableCourses = [...pendingCourses, ...(trainerCoursesData.available || [])];
  const pendingCourseIds = new Set(pendingCourses.map(c => c.id));
  const enrolledCourseIds = new Set(enrolledCourses.map(c => c.id));

  const handleRequestCourse = async (course) => {
    if (pendingCourseIds.has(course.id)) {
      setToastMsg(`Your access request for "${course.title}" is currently pending Admin approval.`);
      setTimeout(() => setToastMsg(''), 4000);
      return;
    }
    const res = await createTrainerCourseRequest({
      trainerId,
      trainerName,
      trainerEmail,
      courseId: course.id,
      courseTitle: course.title
    });
    if (res.success) {
      setToastMsg(`Access request for "${course.title}" submitted successfully! Admin has been notified.`);
      setTimeout(() => setToastMsg(''), 4000);
      await loadTrainerCourses();
    } else {
      setToastMsg(res.message || 'Failed to request course access');
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  const currentTabCourses = activeSubTab === 'enrolled' ? enrolledCourses : availableCourses;

  const filteredCourses = currentTabCourses.filter(c => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  if (selectedCourseForClassroom) {
    return (
      <CourseLearningPage
        courseId={selectedCourseForClassroom.id}
        initialCourse={selectedCourseForClassroom}
        isTrainerLearning={true}
        onBack={() => {
          setSelectedCourseForClassroom(null);
          loadTrainerCourses();
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {toastMsg && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} className="p-1 hover:bg-emerald-700 rounded-lg">✕</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-purple-100 text-purple-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Trainer Portal Access</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Trainer's Courses
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Assigned teaching modules and legitimate professional trainer programs for {trainerName}.
          </p>
        </div>

        {/* Tab Selection: Enrolled / Active vs Available (Requirement 8) */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1 text-xs font-black">
          <button
            onClick={() => setActiveSubTab('enrolled')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'enrolled' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enrolled / Active ({enrolledCourses.length})
          </button>
          <button
            onClick={() => setActiveSubTab('available')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'available' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available Courses ({availableCourses.length})
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search trainer courses by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonList count={3} lines={3} />
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <BookOpen className="w-12 h-12 text-purple-300 mx-auto" />
          {searchTerm ? (
            <>
              <h3 className="text-base font-black text-slate-800">No matching courses found</h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                No courses match "{searchTerm}". Try clearing your search.
              </p>
            </>
          ) : activeSubTab === 'enrolled' ? (
            <>
              <h3 className="text-base font-black text-slate-800">
                You are not enrolled in any course yet
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                Explore the available trainer courses and request access to begin your teaching and professional training journey.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('available')}
                  className="mt-2 inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <span>Explore Available Courses</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-black text-slate-800">
                No Available Courses Found
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                There are no additional available trainer courses to request at this moment.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const isPending = pendingCourseIds.has(course.id);
            const isRejected = (course.requestStatus || '').toLowerCase() === 'rejected';

            return (
              <div key={course.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden flex flex-col justify-between group hover:shadow-lg transition-shadow">
                
                <div>
                  {/* Course Thumbnail */}
                  <div className="relative h-48 bg-slate-900 overflow-hidden">
                    <SafeImage
                      src={resolveFileUrl(course.thumbnail)}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      fallbackSrc="/assets/course-placeholder.svg"
                    />
                    <div className={`absolute top-3 right-3 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow ${
                      isEnrolled ? 'bg-purple-600' : isPending ? 'bg-amber-500' : isRejected ? 'bg-rose-600' : 'bg-slate-800'
                    }`}>
                      {isEnrolled ? 'Enrolled Course' : isPending ? 'Pending Approval' : isRejected ? 'Rejected' : 'Available Course'}
                    </div>

                    {/* Requirement 10.2: Course Duration Display */}
                    <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-xl shadow flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Duration: {course.duration || formatModulesDuration(course.modules) || 'Flexible'}</span>
                    </div>
                  </div>

                  {/* Content Details */}
                  <div className="p-6 space-y-4">
                    <div>
                      {course.category && (
                        <div className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">
                          {course.category}
                        </div>
                      )}
                      <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                        {course.title}
                      </h2>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {course.description}
                    </p>

                    {/* Program Highlights */}
                    {course.benefits && course.benefits.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Program Highlights</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {course.benefits.slice(0, 4).map((benefit, idx) => (
                            <div key={idx} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fee & Mode Specs */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                      <div>
                        <div className="text-slate-400 font-semibold text-[10px]">Course Fee</div>
                        <div className="font-extrabold text-emerald-600 text-xs mt-0.5">
                          {course.price != null && Number(course.price) > 0 ? `₹${Number(course.price).toLocaleString('en-IN')}` : 'Free'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-semibold text-[10px]">Mode</div>
                        <div className="font-extrabold text-slate-800 text-xs mt-0.5">{course.mode || 'Online'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-semibold text-[10px]">Duration</div>
                        <div className="font-extrabold text-purple-900 text-xs mt-0.5">{course.duration || formatModulesDuration(course.modules) || 'Flexible'}</div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="p-6 pt-0 border-t border-slate-100 mt-2">
                  <div className="pt-4 flex items-center justify-between text-xs font-bold text-slate-500">
                    <div className="flex items-center space-x-1 text-purple-700 font-extrabold">
                      <Layers className="w-4 h-4" />
                      <span>{(course.modules || []).length} {(course.modules || []).length === 1 ? 'Module' : 'Modules'}{formatModulesDuration(course.modules) ? ` • ${formatModulesDuration(course.modules)}` : ''}</span>
                    </div>

                    {isEnrolled ? (
                      <div className="flex items-center space-x-2">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Enrolled / Active Access</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCourseForClassroom(course)}
                          className="bg-purple-700 hover:bg-purple-800 text-white font-extrabold px-4 py-2 rounded-xl shadow-xs text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Go to Classroom</span>
                        </button>
                      </div>
                    ) : isPending ? (
                      <button
                        type="button"
                        disabled={true}
                        className="bg-amber-100 text-amber-900 border border-amber-300 px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 cursor-not-allowed opacity-80"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pending Approval</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRequestCourse(course)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2 rounded-xl shadow-xs text-xs flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isRejected ? 'Request again' : 'Request Access / Enquire'}</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
