import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, BookOpen, HelpCircle, AlertTriangle, Info, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTrainerNotifications, markNotificationRead } from '../../api/notificationApi';
import { formatNotificationTime } from '../../utils/notificationDateUtil';
import PageLoader from '../common/PageLoader';

export default function TrainerNotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const trainerIdentifier = user?.name || user?.email || '';

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getTrainerNotifications(trainerIdentifier);
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [trainerIdentifier]);

  const handleNotificationClick = async (item) => {
    if (!item.readStatus) {
      try {
        await markNotificationRead(item.id);
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, readStatus: true } : n));
      } catch (err) {
        console.warn('Failed to mark notification read:', err);
      }
    }
    if (item.type === 'schedule' || item.scheduleId) {
      const targetUrl = item.scheduleId ? `/trainer/schedules?scheduleId=${encodeURIComponent(item.scheduleId)}` : '/trainer/schedules';
      navigate(targetUrl);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  const getIcon = (type) => {
    if (type === 'salary' || type === 'system') return Wallet;
    if (type === 'schedule') return Calendar;
    if (type === 'assignments') return BookOpen;
    return Bell;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Notifications</h1>
        <p className="text-slate-500 text-sm mt-1">Stay updated with salary payments, schedule changes, and alerts for {user?.name || 'Trainer'}.</p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-6 no-scrollbar">
        {[
          { id: 'all', label: 'All' },
          { id: 'salary', label: 'Salary Payments' },
          { id: 'schedule', label: 'Schedule' },
          { id: 'assignments', label: 'Assignments' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[#0F52BA] text-[#0F52BA]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <PageLoader message="Loading notifications..." />
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400">No notifications found.</div>
        ) : (
          filteredNotifications.map(item => {
            const IconComponent = getIcon(item.type);
            const timeInfo = formatNotificationTime(item.createdAt || item.date || item.time);
            return (
              <div 
                key={item.id} 
                onClick={() => handleNotificationClick(item)}
                className={`p-4 hover:bg-slate-50/80 transition-colors flex items-start gap-4 cursor-pointer ${
                  !item.readStatus ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className={`p-2.5 rounded-full border shrink-0 ${
                  !item.readStatus ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-blue-50 text-[#0F52BA] border-blue-200'
                }`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-slate-900 text-base ${!item.readStatus ? 'font-black' : 'font-bold'}`}>{item.title}</h3>
                    <span
                      className="text-xs text-slate-400 shrink-0 font-medium cursor-help"
                      title={timeInfo.exact}
                    >
                      {timeInfo.relative}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{item.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

