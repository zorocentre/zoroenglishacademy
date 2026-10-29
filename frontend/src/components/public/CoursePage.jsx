import React, { useState, useEffect } from 'react';
import { Play, Layers, BookOpen } from 'lucide-react';
import { getCourses } from '../../api/courseApi';
import { resolveFileUrl } from '../../api/fileApi';
import SafeImage from '../common/SafeImage';

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

export default function CoursePage({ onOpenEnquire }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await getCourses();
        if (res.success && Array.isArray(res.data)) {
          // Filter ONLY Student courses for Public Course Page
          const studentCourses = res.data.filter(c => (c.audience || 'student') === 'student');
          setCourses(studentCourses);
          if (studentCourses.length > 0) {
            setSelectedCourseId(studentCourses[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load courses on course page', err);
      }
    }
    loadCourses();
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0] || {};

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {courses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center max-w-lg mx-auto shadow-sm my-12">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <BookOpen className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">No courses available right now</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              We are currently updating our course catalog. Please check back later or get in touch with us!
            </p>
            {onOpenEnquire && (
              <button
                onClick={onOpenEnquire}
                className="mt-6 inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                Contact Us
              </button>
            )}
          </div>
        ) : (
          /* Main Grid: Left Sidebar + Right Course Details */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Course Selector Sidebar */}
          <div className="lg:col-span-3 space-y-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <h3 className="px-3 py-2 text-xs font-black text-slate-400 uppercase tracking-wider">All Courses</h3>
              {courses.map((course) => {
                const isActive = course.id === selectedCourseId;
                return (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{course.title}</span>
                    {isActive && <span className="w-2 h-2 rounded-full bg-white"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Main Course View */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Header & Main Info */}
            {selectedCourse.id ? (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  
                  {/* Text Content */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="inline-block bg-blue-100 text-blue-700 font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                      Featured Course
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                      {selectedCourse.title}
                    </h1>

                    {/* Course Details Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs">
                      <div>
                        <div className="text-slate-400 font-semibold">Course Fee</div>
                        <div className="font-black text-emerald-600 text-sm mt-0.5">
                          {selectedCourse.price != null && Number(selectedCourse.price) > 0 
                            ? `₹${Number(selectedCourse.price).toLocaleString('en-IN')}` 
                            : 'Contact us'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-semibold">Duration</div>
                        <div className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedCourse.duration || 'Flexible'}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-semibold">Mode</div>
                        <div className="font-extrabold text-slate-800 text-sm mt-0.5">{selectedCourse.mode || 'Online'}</div>
                      </div>
                    </div>

                    {selectedCourse.feeBreakdown && (
                      <div className="p-3 bg-blue-50/80 border border-blue-200/60 rounded-xl text-xs font-semibold text-blue-900 leading-relaxed">
                        <span className="font-extrabold text-blue-700">Fee Options & Structure: </span>
                        {selectedCourse.feeBreakdown}
                      </div>
                    )}

                    <button
                      onClick={onOpenEnquire}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg transition-transform transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      Enquire Now
                    </button>
                  </div>

                  {/* Video Preview Card */}
                  <div className="md:col-span-5">
                    <div className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200 group bg-slate-900">
                      <SafeImage
                        src={resolveFileUrl(selectedCourse.thumbnail || selectedCourse.videoUrl)}
                        alt={selectedCourse.title}
                        className="w-full h-56 object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                        fallbackSrc="/assets/course-placeholder.svg"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <button className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-7 h-7 fill-current ml-1" />
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 text-center text-xs font-bold text-white bg-slate-900/80 backdrop-blur-sm py-1.5 px-3 rounded-lg">
                      
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
                Loading courses...
              </div>
            )}

            {/* Course Overview Direct Render */}
            {selectedCourse.id && Boolean((selectedCourse.description || selectedCourse.overview)?.trim()) && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 sm:p-8 space-y-4">
                <h3 className="text-lg font-extrabold text-slate-900">Course Overview</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                  {selectedCourse.description || selectedCourse.overview}
                </p>
              </div>
            )}

            {/* Course Syllabus & Modules */}
            {selectedCourse.id && selectedCourse.modules && selectedCourse.modules.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-extrabold text-slate-900">Course Syllabus & Modules</h3>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    {selectedCourse.modules.length} {selectedCourse.modules.length === 1 ? 'Module' : 'Modules'}
                    {formatModulesDuration(selectedCourse.modules) ? ` • ${formatModulesDuration(selectedCourse.modules)}` : ''}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedCourse.modules.map((mod, idx) => (
                    <div key={mod.id || idx} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-extrabold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{mod.title}</h4>
                          {mod.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{mod.description}</p>
                          )}
                        </div>
                      </div>
                      {mod.duration && (
                        <span className="text-xs font-semibold text-slate-500 shrink-0 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                          {mod.duration}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
        )}

      </div>
    </div>
  );
}
