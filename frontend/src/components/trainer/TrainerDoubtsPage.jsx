import React, { useState, useEffect } from 'react';
import { BookOpen, Layers, Search } from 'lucide-react';
import { getDoubts, resolveDoubt } from '../../api/doubtApi';
import { getCourses, getTrainerCourseRequests, getTrainerEligibleCourses } from '../../api/courseApi';
import { getBatches } from '../../api/batchApi';
import { useAuth } from '../../context/AuthContext';
import { getTrainerAllocatedCourses, getTrainerAllocatedBatches } from '../../utils/trainerFilterHelper';
import { getFriendlyDoubtId } from '../../utils/doubtRefUtil';
import PageLoader from '../common/PageLoader';

export default function TrainerDoubtsPage() {
  const { user } = useAuth();
  const trainerName = user?.name || '';

  const [activeTab, setActiveTab] = useState('open');
  const [doubts, setDoubts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [selectedCourse, setSelectedCourse] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [replyText, setReplyText] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dRes, eligibleCrsRes, cRes, bRes, reqsRes] = await Promise.all([
        getDoubts(),
        getTrainerEligibleCourses().catch(() => ({ success: false, data: [] })),
        getCourses().catch(() => ({ success: false, data: [] })),
        getBatches().catch(() => ({ success: false, data: [] })),
        getTrainerCourseRequests().catch(() => ({ success: false, data: [] }))
      ]);

      const allBatches = bRes?.data || [];
      const studentCourses = (eligibleCrsRes?.success && Array.isArray(eligibleCrsRes.data) && eligibleCrsRes.data.length > 0)
        ? eligibleCrsRes.data.filter(c => (c.audience || '').toLowerCase() !== 'trainer')
        : getTrainerAllocatedCourses(user, cRes?.data || [], allBatches, reqsRes?.data || []).filter(c => (c.audience || '').toLowerCase() !== 'trainer');

      setCourses(studentCourses);

      const allocatedBtcs = getTrainerAllocatedBatches(user, 'All', studentCourses, allBatches);
      setBatches(allocatedBtcs);

      if (dRes?.data) {
        const myDoubts = dRes.data.filter(d => {
          const matchesTrainer = (d.trainerId && user?.id && d.trainerId === user.id) ||
            (d.trainerName && user?.name && d.trainerName.toLowerCase() === user.name.toLowerCase()) ||
            studentCourses.some(c => c.title === d.course || c.id === d.courseId);
          const matchesEligibleStudentCourse = studentCourses.some(c => c.title === d.course || c.id === d.courseId);
          return matchesTrainer && (studentCourses.length === 0 || matchesEligibleStudentCourse);
        });
        setDoubts(myDoubts);
      }
    } catch (err) {
      console.error('Failed to load trainer doubts page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (doubtId) => {
    const text = replyText[doubtId];
    if (!text || !text.trim()) return;

    try {
      const res = await resolveDoubt(doubtId, trainerName, text.trim());
      if (res.success) {
        setMsg('Doubt resolved & answer sent to student!');
        setTimeout(() => setMsg(''), 4000);
        setReplyText(prev => ({ ...prev, [doubtId]: '' }));
        await loadAllData();
      } else {
        setMsg(res.message || 'Failed to submit answer');
        setTimeout(() => setMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to resolve doubt:', err);
      setMsg(err.message || 'Error occurred while submitting answer');
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const availableBatches = getTrainerAllocatedBatches(user, selectedCourse, courses, batches);

  const handleCourseChange = (courseTitle) => {
    setSelectedCourse(courseTitle);
    const newBatches = getTrainerAllocatedBatches(user, courseTitle, courses, batches);
    const isCurrentBatchValid = newBatches.some(b => (b.name || b.title) === selectedBatch);
    if (!isCurrentBatchValid) {
      setSelectedBatch('All');
    }
  };

  // Filter doubts by active tab, Course, Batch, and search term
  const filteredDoubts = doubts.filter(d => {
    const isStatusMatch = activeTab === 'open' 
      ? (d.status?.toUpperCase() === 'OPEN' || d.status?.toUpperCase() === 'PENDING')
      : (d.status?.toUpperCase() === 'RESOLVED' || d.status?.toUpperCase() === 'ANSWERED');

    const matchesCourse = selectedCourse === 'All' || d.course === selectedCourse;
    const matchesBatch = selectedBatch === 'All' || d.batchName === selectedBatch || d.batch === selectedBatch;
    const matchesSearch = !searchTerm || d.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || d.topic?.toLowerCase().includes(searchTerm.toLowerCase());

    return isStatusMatch && matchesCourse && matchesBatch && matchesSearch;
  });

  const openCount = doubts.filter(d => d.status?.toUpperCase() === 'OPEN' || d.status?.toUpperCase() === 'PENDING').length;
  const answeredCount = doubts.filter(d => d.status?.toUpperCase() === 'RESOLVED' || d.status?.toUpperCase() === 'ANSWERED').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Doubts</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Answer student questions and provide guidance for your assigned courses and batches.</p>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-[#0F52BA] text-xs font-bold rounded-xl">
          {msg}
        </div>
      )}

      {/* Course & Batch Dependent Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search doubts by student name or topic..."
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
            <option value="All">All Courses</option>
            {courses.map((c) => (
              <option key={c.id || c.title} value={c.title}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Batch Filter Dropdown */}
        <div className="flex items-center space-x-1.5">
          <Layers className="w-4 h-4 text-purple-600" />
          <select 
            value={selectedBatch} 
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none border border-slate-200 cursor-pointer"
          >
            <option value="All">All Batches</option>
            {availableBatches.map((b) => (
              <option key={b.id || b.name} value={b.name || b.title}>{b.name || b.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('open')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'open'
              ? 'border-[#0F52BA] text-[#0F52BA] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Open Doubts ({openCount})
        </button>
        <button
          onClick={() => setActiveTab('answered')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer ${
            activeTab === 'answered'
              ? 'border-[#0F52BA] text-[#0F52BA] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Answered ({answeredCount})
        </button>
      </div>

      {/* Doubts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 bg-white rounded-3xl border border-slate-200">
            <PageLoader message="Loading student doubts..." />
          </div>
        ) : filteredDoubts.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400 bg-white rounded-3xl border border-slate-200">
            No {activeTab} doubts match the selected Course and Batch filters.
          </div>
        ) : (
          filteredDoubts.map((doubt, index) => (
            <div key={doubt.id} className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F52BA] text-white flex items-center justify-center font-black text-sm shadow-xs uppercase">
                    {(doubt.studentName || 'S').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-sm">{doubt.studentName}</h3>
                      <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{getFriendlyDoubtId(doubt, index, doubts)}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold">
                      {(doubt.courseMode?.toLowerCase() === 'recorded' || doubt.mode?.toLowerCase() === 'recorded')
                        ? `${doubt.course} • Topic: ${doubt.topic}`
                        : `${doubt.course} • Batch: ${doubt.batchName || 'Unassigned'} • Topic: ${doubt.topic}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">{doubt.createdOn || 'Recent'}</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                    doubt.status?.toUpperCase() === 'OPEN'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {doubt.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl text-slate-800 font-medium text-xs leading-relaxed border border-slate-100">
                "{doubt.question}"
              </div>

              {doubt.status?.toUpperCase() === 'OPEN' || doubt.status?.toUpperCase() === 'PENDING' ? (
                <div className="space-y-3 pt-2">
                  <label htmlFor={`doubt-reply-${doubt.id}`} className="block text-xs font-bold text-slate-700">
                    Your Answer & Guidance:
                  </label>
                  <textarea
                    id={`doubt-reply-${doubt.id}`}
                    rows={3}
                    placeholder="Type your detailed answer or guidance for the student..."
                    aria-label={`Reply to ${doubt.studentName}`}
                    value={replyText[doubt.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [doubt.id]: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleReply(doubt.id)}
                      disabled={!replyText[doubt.id] || !replyText[doubt.id].trim()}
                      className="bg-[#0F52BA] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-sm cursor-pointer transition-colors"
                    >
                      Send Answer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-900 font-medium space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-800 text-[10px] uppercase tracking-wider">
                      Resolved Answer ({doubt.resolvedBy || doubt.trainerName || trainerName}):
                    </span>
                    {doubt.replyDate && (
                      <span className="text-[10px] text-emerald-600 font-bold">{doubt.replyDate}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{doubt.answer || doubt.reply || 'No answer recorded.'}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
