import React, { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, Layers, Users, Video } from 'lucide-react';
import { getTrainerStudents } from '../../api/userApi';
import { getCourses, getTrainerCourseRequests } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { useAuth } from '../../context/AuthContext';
import { getTrainerAllocatedCourses, getTrainerAllocatedBatches } from '../../utils/trainerFilterHelper';
import PageLoader from '../common/PageLoader';

export default function TrainerStudentsPage() {
  const { user } = useAuth();
  const trainerName = user?.name || '';
  const trainerId = user?.id || '';
  const trainerEmail = (user?.email || '').toLowerCase().trim();

  // Switch tab: 'online_hybrid' | 'recorded'
  const [activeTab, setActiveTab] = useState('online_hybrid');
  const [students, setStudents] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [stdRes, crsRes, btcRes, reqsRes] = await Promise.all([
          getTrainerStudents(),
          getCourses(),
          getBatches(),
          getTrainerCourseRequests(trainerId)
        ]);

        const rawCourses = crsRes.data || [];
        const rawBatches = btcRes.data || [];
        const rawReqs = reqsRes.data || [];

        setAllCourses(rawCourses);
        setAllBatches(rawBatches);
        setApprovedRequests(rawReqs);

        if (stdRes.success && Array.isArray(stdRes.data)) {
          const activeStudents = stdRes.data.filter(s => (s.status || '').toLowerCase() !== 'inactive' && !s.isDeleted);
          setStudents(activeStudents);
        }
      } catch (err) {
        console.error('Failed to load trainer students page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, trainerId]);

  // Batches handled directly by this trainer
  const trainerBatches = useMemo(() => {
    return allBatches.filter(b => {
      const bTrainerId = b.trainerId;
      const bTrainer = (b.trainerName || b.trainer || b.assignedTrainer || '').toLowerCase().trim();
      const bEmail = (b.trainerEmail || '').toLowerCase().trim();
      const tName = trainerName.toLowerCase().trim();
      return (trainerId && bTrainerId === trainerId) ||
             (tName && (bTrainer === tName || bTrainer.includes(tName))) ||
             (trainerEmail && bEmail === trainerEmail);
    });
  }, [allBatches, trainerId, trainerName, trainerEmail]);

  // Courses allocated to this trainer
  const allocatedCourses = useMemo(() => {
    return getTrainerAllocatedCourses(user, allCourses, allBatches, approvedRequests);
  }, [user, allCourses, allBatches, approvedRequests]);

  // Segregate allocated courses into Recorded vs Online/Hybrid
  const recordedCourses = useMemo(() => {
    return allocatedCourses.filter(c => (c.mode || '').toLowerCase().trim() === 'recorded');
  }, [allocatedCourses]);

  const onlineHybridCourses = useMemo(() => {
    return allocatedCourses.filter(c => (c.mode || '').toLowerCase().trim() !== 'recorded');
  }, [allocatedCourses]);

  // Check if a course/batch item from a student strictly belongs to THIS trainer
  const isItemBelongingToTrainer = (cb) => {
    const cName = (cb.course || cb.courseName || '').toLowerCase().trim();
    const cId = (cb.courseId || '').toLowerCase().trim();

    const matchingCourse = allCourses.find(c => 
      (cId && (c.id || '').toLowerCase().trim() === cId) ||
      (cName && (c.title || '').toLowerCase().trim() === cName)
    );

    if (!matchingCourse) return false;

    // Check if this course is allocated to this trainer
    const courseAllocated = allocatedCourses.some(c => c.id === matchingCourse.id || (c.title || '').toLowerCase().trim() === cName);
    if (!courseAllocated) return false;

    const isRecorded = (matchingCourse.mode || '').toLowerCase().trim() === 'recorded';
    if (isRecorded) {
      return true;
    }

    // For Online/Hybrid courses:
    // If the trainer is directly the assigned trainer for the entire course, allow it
    const cAssigned = (matchingCourse.assignedTrainer || matchingCourse.trainerName || matchingCourse.trainer || '').toLowerCase().trim();
    const tName = trainerName.toLowerCase().trim();
    if (tName && (cAssigned === tName || cAssigned.includes(tName))) return true;
    if (trainerId && matchingCourse.trainerId === trainerId) return true;

    // Otherwise, check if this specific batch belongs to this trainer
    const bName = (cb.batch || cb.batchName || '').toLowerCase().trim();
    const bId = (cb.batchId || '').toLowerCase().trim();

    return trainerBatches.some(tb => 
      (bId && (tb.id || '').toLowerCase().trim() === bId) ||
      (bName && (tb.name || tb.title || '').toLowerCase().trim() === bName)
    );
  };

  // Process all students and attach their filtered course-batches strictly belonging to THIS trainer
  const processedStudents = useMemo(() => {
    return students.map(s => {
      const rawItems = s.courseBatches && s.courseBatches.length > 0
        ? s.courseBatches
        : (s.course ? [{ course: s.course, batch: s.batch || 'Unassigned', courseId: s.courseId, batchId: s.batchId }] : []);

      // Filter strictly to courses/batches belonging to THIS trainer
      const trainerItems = rawItems.filter(isItemBelongingToTrainer).map(cb => {
        const cName = (cb.course || cb.courseName || '').toLowerCase().trim();
        const cId = (cb.courseId || '').toLowerCase().trim();
        const fullCourse = allCourses.find(c => 
          (cId && (c.id || '').toLowerCase().trim() === cId) ||
          (cName && (c.title || '').toLowerCase().trim() === cName)
        );
        const mode = (fullCourse?.mode || 'Online').toLowerCase().trim();
        return {
          ...cb,
          course: fullCourse?.title || cb.course,
          batch: cb.batch || 'Unassigned',
          mode
        };
      });

      const recordedItems = trainerItems.filter(item => item.mode === 'recorded');
      const onlineHybridItems = trainerItems.filter(item => item.mode !== 'recorded');

      return {
        ...s,
        trainerItems,
        recordedItems,
        onlineHybridItems
      };
    });
  }, [students, allCourses, allocatedCourses, trainerBatches, trainerName, trainerId]);

  // Partition students based on active switch tab
  const recordedStudents = useMemo(() => {
    return processedStudents.filter(s => s.recordedItems.length > 0);
  }, [processedStudents]);

  const onlineHybridStudents = useMemo(() => {
    return processedStudents.filter(s => s.onlineHybridItems.length > 0);
  }, [processedStudents]);

  // Tab-specific course & batch options for filter dropdowns
  const currentTabCourses = activeTab === 'recorded' ? recordedCourses : onlineHybridCourses;

  const currentTabBatches = useMemo(() => {
    if (activeTab === 'recorded') return [];
    return getTrainerAllocatedBatches(user, selectedCourse, onlineHybridCourses, allBatches);
  }, [activeTab, user, selectedCourse, onlineHybridCourses, allBatches]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSelectedCourse('All');
    setSelectedBatch('All');
  };

  const handleCourseChange = (courseTitle) => {
    setSelectedCourse(courseTitle);
    if (activeTab === 'online_hybrid') {
      const newBatches = getTrainerAllocatedBatches(user, courseTitle, onlineHybridCourses, allBatches);
      const isCurrentBatchValid = newBatches.some(b => (b.id === selectedBatch) || ((b.name || b.title) === selectedBatch));
      if (!isCurrentBatchValid) {
        setSelectedBatch('All');
      }
    }
  };

  // Filter students for the active tab table
  const activeStudentList = activeTab === 'recorded' ? recordedStudents : onlineHybridStudents;

  const displayedStudents = activeStudentList
    .map(s => {
      const baseItems = activeTab === 'recorded' ? s.recordedItems : s.onlineHybridItems;
      let displayItems = baseItems;

      if (selectedCourse !== 'All') {
        displayItems = displayItems.filter(cb => (cb.course || '').toLowerCase().trim() === selectedCourse.toLowerCase().trim());
      }

      if (activeTab === 'online_hybrid' && selectedBatch !== 'All') {
        displayItems = displayItems.filter(cb => (cb.batch || '').toLowerCase().trim() === selectedBatch.toLowerCase().trim());
      }

      return {
        ...s,
        displayItems
      };
    })
    .filter(s => s.displayItems.length > 0)
    .filter(s => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) ||
             (s.email || '').toLowerCase().includes(q);
    });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header Banner with Switch Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-purple-100 text-purple-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            <span>Trainer Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Students
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Manage and view active students assigned to your courses and batches for {trainerName}.
          </p>
        </div>

        {/* Tab Selection: Recorded Course Students vs Online & Hybrid Students */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1 text-xs font-black">
          <button
            type="button"
            onClick={() => handleTabSwitch('recorded')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'recorded' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recorded Course Students ({recordedStudents.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('online_hybrid')}
            className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'online_hybrid' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Online & Hybrid Students ({onlineHybridStudents.length})
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
          />
        </div>

        {/* Course Filter Dropdown */}
        <div className="flex items-center space-x-1.5">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <select 
            value={selectedCourse} 
            onChange={(e) => handleCourseChange(e.target.value)}
            className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none border border-slate-200 cursor-pointer"
          >
            <option value="All">All {activeTab === 'recorded' ? 'Recorded' : 'Online & Hybrid'} Courses</option>
            {currentTabCourses.map((c) => (
              <option key={c.id || c.title} value={c.title}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Batch Filter Dropdown (Enabled only for Online & Hybrid) */}
        {activeTab === 'online_hybrid' && (
          <div className="flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-purple-600" />
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none border border-slate-200 cursor-pointer"
            >
              <option value="All">All Batches</option>
              {currentTabBatches.map((b) => (
                <option key={b.id || b.name || b.title} value={b.name || b.title}>{b.name || b.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Student List Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        {loading ? (
          <PageLoader message="Loading students..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Assigned Course</th>
                  {activeTab === 'online_hybrid' && <th className="py-3 px-4">Batch</th>}
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {displayedStudents.length > 0 ? (
                  displayedStudents.map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900">{s.name}</div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800 space-y-1">
                        {s.displayItems.map((cb, i) => (
                          <div key={i} className="text-xs font-bold text-slate-800">
                            {cb.course}
                          </div>
                        ))}
                      </td>
                      {activeTab === 'online_hybrid' && (
                        <td className="py-4 px-4 font-bold text-purple-900 space-y-1">
                          {s.displayItems.map((cb, i) => (
                            <div key={i} className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg inline-block mr-1">
                              {cb.batch}
                            </div>
                          ))}
                        </td>
                      )}
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {s.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={activeTab === 'online_hybrid' ? 5 : 4} className="py-12 text-center text-slate-400 font-medium text-xs">
                      No active {activeTab === 'recorded' ? 'recorded course' : 'online or hybrid'} students match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
