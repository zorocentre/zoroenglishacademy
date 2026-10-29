import React, { useState, useEffect } from 'react';
import { Bell, Wallet, Calendar, CheckSquare, Trash2, CheckCircle2, Clock, Filter, AlertTriangle } from 'lucide-react';
import { getMyNotifications, markNotificationRead, deleteNotification } from '../../api/notificationApi';
import { formatNotificationTime } from '../../utils/notificationDateUtil';
import { useDialog } from '../../context/DialogContext';

export default function AdminNotificationsPage() {
  const { showSuccess, showError } = useDialog();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await getMyNotifications();
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to load admin notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      const res = await markNotificationRead(id);
      if (res.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, readStatus: true } : n));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await deleteNotification(id);
      if (res.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await showSuccess('Notification removed', 'Deleted');
      } else {
        await showError(res?.message || 'Failed to delete notification', 'Delete Error');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to delete notification', 'Delete Error');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.readStatus);
    if (unread.length === 0) return;

    try {
      await Promise.all(unread.map(n => markNotificationRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, readStatus: true })));
      await showSuccess('All notifications marked as read', 'Updated');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.readStatus;
    if (filter === 'read') return n.readStatus;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.readStatus).length;

  const getNotificationIcon = (title = '', desc = '') => {
    const text = `${title} ${desc}`.toLowerCase();
    if (text.includes('salary') || text.includes('fee') || text.includes('payment') || text.includes('₹')) {
      return { icon: Wallet, bg: 'bg-amber-50 text-amber-600 border-amber-200' };
    }
    if (text.includes('schedule') || text.includes('class') || text.includes('session')) {
      return { icon: Calendar, bg: 'bg-blue-50 text-blue-600 border-blue-200' };
    }
    if (text.includes('registration') || text.includes('competition')) {
      return { icon: CheckSquare, bg: 'bg-purple-50 text-purple-600 border-purple-200' };
    }
    return { icon: Bell, bg: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-blue-600" />
            <span>Admin Notifications</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">System alerts, daily salary payment due reminders, and operational updates.</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer self-start sm:self-auto transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-[#0F52BA] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'unread'
              ? 'bg-[#0F52BA] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Unread ({unreadCount})
        </button>

        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            filter === 'read'
              ? 'bg-[#0F52BA] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400 space-y-2">
            <Bell className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No notifications match the selected filter.</p>
          </div>
        ) : (
          filteredNotifications.map(item => {
            const { icon: IconComp, bg } = getNotificationIcon(item.title, item.desc || item.message);
            const isUnread = !item.readStatus;
            const timeInfo = formatNotificationTime(item.createdAt || item.date || item.time);

            return (
              <div 
                key={item.id} 
                className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                  isUnread ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div className={`p-3 rounded-2xl border shrink-0 ${bg}`}>
                    <IconComp className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-black tracking-tight ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {item.title}
                      </h3>
                      {isUnread && (
                        <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          New
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {item.desc || item.message}
                    </p>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-semibold pt-1">
                      <span className="inline-flex items-center gap-1 cursor-help" title={timeInfo.exact}>
                        <Clock className="w-3 h-3 text-slate-400" />
                        {timeInfo.relative}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1.5 shrink-0 self-start sm:self-center">
                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer text-xs font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete notification"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
