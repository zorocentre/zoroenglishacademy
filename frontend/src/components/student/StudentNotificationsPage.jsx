import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Calendar, BookOpen, HelpCircle, CheckCircle2, MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyNotifications } from '../../api/notificationApi';
import { formatNotificationTime } from '../../utils/notificationDateUtil';
import PageLoader from '../common/PageLoader';

export default function StudentNotificationsPage({ setActiveScreen }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await getMyNotifications();
        setNotifications(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        console.error('Failed to load student notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getCategory = (item) => {
    const t = (item.title || '').toLowerCase();
    const m = (item.message || item.desc || '').toLowerCase();
    if (t.includes('schedule') || m.includes('schedule') || t.includes('class') || m.includes('class')) return 'schedule';
    if (t.includes('assignment') || m.includes('assignment') || t.includes('homework') || m.includes('homework')) return 'assignment';
    if (t.includes('doubt') || m.includes('doubt') || t.includes('question') || m.includes('question')) return 'doubt';
    return 'general';
  };

  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return getCategory(n) === activeTab;
  });

  const getIcon = (item) => {
    const cat = getCategory(item);
    if (cat === 'schedule') return Calendar;
    if (cat === 'assignment') return BookOpen;
    if (cat === 'doubt') return MessageSquare;
    return Bell;
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      <button 
        onClick={() => setActiveScreen('student-dash')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-xs text-slate-500 font-medium">Updates, schedule changes, doubts replies, and academy alerts for {user?.name || 'Student'}.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-6 no-scrollbar">
        {[
          { id: 'all', label: 'All Updates' },
          { id: 'schedule', label: 'Class Schedules' },
          { id: 'assignment', label: 'Assignments' },
          { id: 'doubt', label: 'Doubts & Q&A' },
          { id: 'general', label: 'General' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-xs font-bold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <PageLoader message="Loading notifications..." />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">No notifications found.</div>
        ) : (
          filtered.map(item => {
            const Icon = getIcon(item);
            const timeInfo = formatNotificationTime(item.createdAt || item.date || item.time);
            return (
              <div key={item.id} className="p-5 hover:bg-slate-50/80 transition-colors flex items-start gap-4">
                <div className="p-2.5 rounded-2xl border bg-blue-50 text-blue-600 border-blue-200/60 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-slate-900 text-sm">{item.title}</h3>
                    <span
                      className="text-[11px] text-slate-400 shrink-0 font-semibold cursor-help"
                      title={timeInfo.exact}
                    >
                      {timeInfo.relative}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{item.message || item.desc}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
