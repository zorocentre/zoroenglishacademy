import React, { useState, useEffect } from 'react';
import { HelpCircle, MessageSquare, Send, CheckCircle2, User, Search, Layers, Clock } from 'lucide-react';
import { getDoubts, resolveDoubt } from '../../api/doubtApi';
import { getFriendlyDoubtId } from '../../utils/doubtRefUtil';
import PageLoader from '../common/PageLoader';

export default function AdminDoubtsPage() {
  const [activeModeTab, setActiveModeTab] = useState('Online'); // 'Online' | 'Recorded' | 'Hybrid'
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'open' | 'resolved'
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState({});
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoubts();
  }, []);

  const loadDoubts = async () => {
    setLoading(true);
    try {
      const res = await getDoubts();
      setDoubts(res.data || []);
    } catch (err) {
      console.error('Failed to load doubts for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (id) => {
    const text = replyText[id];
    if (!text || !text.trim()) return;

    try {
      const res = await resolveDoubt(id, 'Admin', text);
      if (res.success) {
        setReplyText(prev => ({ ...prev, [id]: '' }));
        await loadDoubts();
      }
    } catch (err) {
      console.error('Failed to reply to doubt:', err);
    }
  };

  // Filter doubts by Mode Tab (Online, Recorded, Hybrid)
  const modeFilteredDoubts = doubts.filter(d => (d.courseMode || d.mode || 'Online') === activeModeTab);

  // Filter by Status Tab & Search Query
  const finalFilteredDoubts = modeFilteredDoubts.filter(d => {
    if (statusTab === 'open' && d.status?.toUpperCase() !== 'OPEN' && d.status?.toUpperCase() !== 'PENDING') return false;
    if (statusTab === 'resolved' && d.status?.toUpperCase() !== 'RESOLVED' && d.status?.toUpperCase() !== 'ANSWERED') return false;

    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (d.studentName && d.studentName.toLowerCase().includes(q)) ||
      (d.question && d.question.toLowerCase().includes(q)) ||
      (d.course && d.course.toLowerCase().includes(q)) ||
      (d.topic && d.topic.toLowerCase().includes(q))
    );
  });

  // Group filtered doubts Batch-wise
  const groupedByBatch = finalFilteredDoubts.reduce((acc, d) => {
    const batch = d.batchName || 'General Batch';
    if (!acc[batch]) acc[batch] = [];
    acc[batch].push(d);
    return acc;
  }, {});

  if (loading) {
    return <PageLoader fullPage message="Loading doubts..." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-purple-100 text-purple-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Student Query Resolution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Student Doubts & Questions
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Batch-wise & student-wise query management across Online, Recorded, and Hybrid learning modes.
          </p>
        </div>
      </div>

      {/* TOP THREE SWITCHING HEADINGS/TABS: Online, Recorded, Hybrid */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2">
        {['Online', 'Recorded', 'Hybrid'].map((tab) => {
          const isActive = activeModeTab === tab;
          const count = doubts.filter(d => (d.courseMode || d.mode || 'Online') === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveModeTab(tab)}
              className={`flex-1 min-w-[120px] py-3 px-5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{tab} Doubts</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isActive ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between gap-3 items-center">
        <div className="flex border-b border-slate-200 gap-6 w-full sm:w-auto">
          {['all', 'open', 'resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusTab(st)}
              className={`pb-2.5 text-xs font-bold capitalize transition-colors border-b-2 ${
                statusTab === st
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {st} Doubts
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeModeTab} doubts by student or topic...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Doubts Batch-wise Cards */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400">
          Loading {activeModeTab} doubts...
        </div>
      ) : Object.keys(groupedByBatch).length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">No {activeModeTab} Doubts Found</h3>
          <p className="text-xs text-slate-500 font-medium">
            No student questions submitted under {activeModeTab} mode matching the current search filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByBatch).map(([batchName, batchDoubts]) => (
            <div key={batchName} className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden p-6 space-y-5">
              
              {/* Batch Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black text-sm border border-purple-200/60">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">{batchName}</h2>
                    <p className="text-xs text-slate-500 font-semibold">{batchDoubts.length} Doubts in {activeModeTab} Mode</p>
                  </div>
                </div>
              </div>

              {/* Doubt Items List for this Batch */}
              <div className="space-y-4">
                {batchDoubts.map((doubt, index) => {
                  const isOpen = doubt.status?.toUpperCase() === 'OPEN' || doubt.status?.toUpperCase() === 'PENDING';
                  return (
                    <div key={doubt.id} className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-5 space-y-4">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs uppercase">
                            {(doubt.studentName || 'S').charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-slate-900 text-sm">{doubt.studentName}</h3>
                              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{getFriendlyDoubtId(doubt, index, doubts)}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold">
                              Course: <span className="font-bold text-blue-700">{doubt.course}</span> • Topic: <span className="text-slate-800 font-bold">{doubt.topic || 'General Query'}</span> • Trainer: <span className="text-purple-700 font-bold">{doubt.trainerName || 'Admin'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-start sm:self-auto">
                          <span className="text-[11px] text-slate-400 font-medium">{doubt.createdOn || 'Recent'}</span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            isOpen
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {doubt.status}
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="bg-white p-4 rounded-xl text-slate-800 font-medium text-xs leading-relaxed border border-slate-200/60 shadow-xs">
                        <span className="font-bold text-slate-900 block mb-1">Doubt Question:</span>
                        "{doubt.question}"
                      </div>

                      {/* Answer / Response Block */}
                      {doubt.answer && (
                        <div className="bg-blue-50/70 p-4 rounded-xl text-blue-950 text-xs leading-relaxed border border-blue-200/60 space-y-1">
                          <div className="font-extrabold text-blue-800 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Response by {doubt.trainerName || 'Instructor'}:</span>
                          </div>
                          <p className="font-medium text-slate-800">{doubt.answer}</p>
                        </div>
                      )}

                      {/* Answer Input Box */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder={isOpen ? "Enter answer / response for student..." : "Update response..."}
                          value={replyText[doubt.id] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [doubt.id]: e.target.value })}
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                        />
                        <button
                          onClick={() => handleReply(doubt.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-xs flex items-center space-x-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isOpen ? 'Send Reply' : 'Update'}</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
