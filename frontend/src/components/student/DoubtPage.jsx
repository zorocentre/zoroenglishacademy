import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, CheckCircle, Clock, MessageSquare, ChevronRight, X, AlertTriangle } from 'lucide-react';
import { getDoubts, createDoubt } from '../../api/doubtApi';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { useAuth } from '../../context/AuthContext';
import { getFriendlyDoubtId } from '../../utils/doubtRefUtil';

export default function DoubtPage({ setActiveScreen }) {
  const { user } = useAuth();
  const [doubtsList, setDoubtsList] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [activeDoubtModal, setActiveDoubtModal] = useState(null);
  const [msg, setMsg] = useState('');
  const [doubtsEnabled, setDoubtsEnabled] = useState(true);

  const studentName = user?.name || '';
  const studentEmail = user?.email || '';
  const studentIdentifier = user?.id || user?.email || '';

  useEffect(() => {
    loadDoubts();
    loadCourses();
  }, [studentIdentifier]);

  const loadCourses = async () => {
    if (!studentIdentifier) return;
    try {
      const courses = await getStudentEnrolledCourses(studentIdentifier);
      const list = Array.isArray(courses) ? courses : [];
      setEnrolledCourses(list);
      if (list.length > 0) {
        const firstCrs = list[0];
        const cid = firstCrs.courseId || firstCrs.id;
        setSelectedCourseId(cid);
        if (firstCrs.trainers && firstCrs.trainers.length > 0) {
          setSelectedTrainerId(firstCrs.trainers[0].id);
        } else {
          setSelectedTrainerId('');
        }
      }
    } catch (err) {
      console.error('Failed to load student enrolled courses for doubts:', err);
    }
  };

  const loadDoubts = async () => {
    try {
      const res = await getDoubts();
      if (res.success && res.data) {
        const myDoubts = res.data.filter(d => 
          (d.studentEmail && d.studentEmail.toLowerCase() === studentEmail.toLowerCase()) || 
          (d.studentId && d.studentId === user?.id) ||
          (d.studentName && d.studentName.toLowerCase() === studentName.toLowerCase())
        );
        setDoubtsList(myDoubts.length > 0 ? myDoubts : res.data);
      }
    } catch (err) {
      console.error('Failed to load doubts:', err);
    }
  };

  const selectedCourse = enrolledCourses.find(c => (c.courseId || c.id) === selectedCourseId) || (enrolledCourses[0] || null);
  const isRecorded = selectedCourse?.courseMode?.toLowerCase() === 'recorded' || selectedCourse?.mode?.toLowerCase() === 'recorded';
  const batchTrainers = selectedCourse?.trainers || [];

  const handleCourseChange = (newCourseId) => {
    setSelectedCourseId(newCourseId);
    const crs = enrolledCourses.find(c => (c.courseId || c.id) === newCourseId);
    if (crs && Array.isArray(crs.trainers) && crs.trainers.length > 0) {
      setSelectedTrainerId(crs.trainers[0].id);
    } else {
      setSelectedTrainerId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!doubtsEnabled) {
      setMsg('Doubts forum is currently disabled by administrator.');
      return;
    }
    if (!question.trim()) return;
    if (!selectedCourse) {
      setMsg('Please select an enrolled course.');
      return;
    }

    let trainerId = null;
    let trainerName = 'Admin';

    if (isRecorded) {
      trainerId = selectedCourse.trainerId || null;
      trainerName = selectedCourse.trainerName || 'Admin';
    } else {
      if (!selectedTrainerId && batchTrainers.length > 0) {
        setMsg('Please select a trainer assigned to your batch.');
        return;
      }
      trainerId = selectedTrainerId || null;
      const matchedTrainer = batchTrainers.find(t => t.id === selectedTrainerId);
      trainerName = matchedTrainer ? matchedTrainer.name : (selectedCourse.trainerName || 'Trainer');
    }

    try {
      const res = await createDoubt({
        studentId: user?.id,
        studentName,
        studentEmail,
        courseId: selectedCourse.courseId || selectedCourse.id,
        courseTitle: selectedCourse.courseTitle || selectedCourse.title,
        courseMode: selectedCourse.courseMode || selectedCourse.mode || 'Online',
        batchId: selectedCourse.batchId || null,
        trainerId,
        trainerName,
        topic: topic.trim(),
        question: question.trim()
      });

      if (res.success) {
        setMsg('Doubt submitted successfully!');
        setTimeout(() => setMsg(''), 3000);
        setQuestion('');
        setTopic('');
        await loadDoubts();
      } else {
        setMsg(res.message || 'Failed to submit doubt.');
      }
    } catch (err) {
      setMsg('Failed to submit doubt.');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Breadcrumb Navigation */}
      <button 
        onClick={() => setActiveScreen('student-dash')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Student Dashboard</span>
      </button>

      {!doubtsEnabled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl flex items-center space-x-3 text-xs font-bold shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>The Doubts Forum is currently disabled by administrator. New submission is paused.</span>
        </div>
      )}

      <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ask a Doubt</h1>

      {msg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-[#0F52BA] text-xs font-bold rounded-xl">
          {msg}
        </div>
      )}

      {/* Main Grid: Left Ask Form + Right Recent Doubts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Ask Form Panel (Photo Upload Removed as per Requirement 13) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Course *</label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                >
                  {enrolledCourses.length === 0 ? (
                    <option value="">No enrolled courses</option>
                  ) : (
                    enrolledCourses.map(c => (
                      <option key={c.courseId || c.id} value={c.courseId || c.id}>
                        {c.courseTitle || c.title} ({c.courseMode || c.mode || 'Online'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {isRecorded ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Trainer (Recorded)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={selectedCourse?.trainerName || 'Admin'}
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {selectedCourse?.trainerName ? 'Routed to course trainer & Admin' : 'No trainer assigned; routed to Admin only'}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Trainer *</label>
                  <select
                    required
                    value={selectedTrainerId}
                    onChange={(e) => setSelectedTrainerId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    {batchTrainers.length === 0 ? (
                      <option value="">No trainers assigned to your batch</option>
                    ) : (
                      batchTrainers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name || 'Trainer'}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Routed to selected batch trainer & Admin
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic *</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Question on Module 2 exercise or session topic"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Question *</label>
              <textarea
                rows={4}
                required
                placeholder="Type your doubt here..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform transform active:scale-95 text-sm cursor-pointer"
            >
              Submit Doubt
            </button>
          </form>
        </div>

        {/* Right Recent Doubts List */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900">Recent Doubts</h3>
            <span className="text-[10px] font-bold text-slate-400">Total: {doubtsList.length}</span>
          </div>

          <div className="space-y-3">
            {doubtsList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No doubts asked yet.</p>
            ) : (
              doubtsList.map((doubt, idx) => (
                <div 
                  key={doubt.id} 
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">{getFriendlyDoubtId(doubt, idx, doubtsList)}</span>
                      <span className="text-xs font-extrabold text-slate-900">{doubt.topic}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      doubt.status?.toUpperCase() === 'RESOLVED' || doubt.status?.toUpperCase() === 'ANSWERED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      Status: {doubt.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-semibold">
                    <span>{doubt.courseTitle || doubt.course} ({doubt.courseMode || doubt.mode || 'Online'})</span>
                    <span>•</span>
                    <span>Trainer: {doubt.trainerName || 'Admin'}</span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 font-medium">{doubt.question}</p>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => setActiveDoubtModal(doubt)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      View Answer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Answer Modal */}
      {activeDoubtModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90dvh] overflow-y-auto">
            <button 
              onClick={() => setActiveDoubtModal(null)}
              className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{getFriendlyDoubtId(activeDoubtModal, doubtsList.findIndex(d => d.id === activeDoubtModal.id), doubtsList)}</span>
              <h3 className="text-base font-black text-slate-900 mt-1">{activeDoubtModal.topic}</h3>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
              <strong>Question:</strong> {activeDoubtModal.question}
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <strong className="block font-bold">Trainer Response ({activeDoubtModal.trainerName || 'Trainer'}):</strong>
              <p>{activeDoubtModal.answer || 'Trainer is currently reviewing your question.'}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
