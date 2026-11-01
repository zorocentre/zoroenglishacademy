import React from 'react';
import { 
  LayoutDashboard, Users, BookOpen, UserCheck, Calendar, 
  CreditCard, FileText, HelpCircle, BarChart3, Settings, 
  User, Video, Clock, LogOut, Bell, CheckSquare, X, Wallet, FileSpreadsheet, Layers, Trophy, MessageSquare, Award, FileCheck
} from 'lucide-react';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';
import Logo from '../common/Logo';

export default function DashboardSidebar({ role, activeScreen, setActiveScreen, isMobileOpen, onMobileClose }) {
  const { academyName } = useWebsiteSettings();
  let menuItems = [];

  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'Admin') {
    menuItems = [
      { id: 'admin-dash', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'admin-manage-courses', label: 'Manage Courses', icon: BookOpen },
      { id: 'admin-batch-management', label: 'Batch Management', icon: Layers },
      { id: 'admin-manage-students', label: 'Manage Students', icon: Users },
      { id: 'admin-manage-trainers', label: 'Manage Trainers', icon: UserCheck },
      { id: 'admin-attendance', label: 'Attendance', icon: Clock },
      { id: 'admin-schedule', label: 'Schedule', icon: Calendar },
      { id: 'admin-trainer-sessions', label: 'Trainers Session', icon: Video },
      { id: 'admin-assignments', label: 'Assignments', icon: FileText },
      { id: 'admin-trainer-assignments', label: 'Trainer Assignments', icon: Award },
      { id: 'admin-doubts', label: 'Doubts', icon: HelpCircle },
      { id: 'admin-enquiries', label: 'Enquiry Details', icon: MessageSquare },
      { id: 'admin-fees', label: 'Student Fees', icon: CreditCard },
      { id: 'admin-expenses', label: 'Expenses', icon: Wallet },
      { id: 'admin-salary', label: 'Trainer Salary', icon: Wallet },
      { id: 'admin-daily-reports', label: 'Daily Reports', icon: FileSpreadsheet },
      { id: 'admin-competition', label: 'Competitions', icon: Trophy },
      { id: 'admin-competition-management', label: 'Competition Management', icon: Award },
      { id: 'admin-competition-registrations', label: 'Competition Registrations', icon: CheckSquare },
      { id: 'admin-competition-evaluations', label: 'Competition Evaluations', icon: FileCheck },
      { id: 'admin-reports', label: 'Reports', icon: BarChart3 },
      { id: 'admin-notifications', label: 'Notifications', icon: Bell },
      { id: 'admin-settings', label: 'Settings', icon: Settings },
    ];

  } else if (role === 'TRAINER' || role === 'Trainer') {
    menuItems = [
      { id: 'trainer-dash', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'trainer-courses', label: "Trainer's Courses", icon: BookOpen },
      { id: 'trainer-competitions', label: 'Competitions', icon: Trophy },
      { id: 'trainer-students', label: 'Students', icon: Users },
      { id: 'trainer-schedule', label: 'Schedule', icon: Calendar },
      { id: 'trainer-sessions', label: 'Sessions', icon: Video },
      { id: 'trainer-assignments', label: 'Extra Assignment', icon: FileText },
      { id: 'trainer-submissions', label: 'Submissions', icon: CheckSquare },
      { id: 'trainer-doubts', label: 'Doubts', icon: HelpCircle },
      { id: 'trainer-attendance', label: 'Attendance', icon: Clock },
      { id: 'trainer-notifications', label: 'Notifications', icon: Bell },
      { id: 'trainer-profile', label: 'My Profile', icon: User },
    ];
  } else {
    // Student
    menuItems = [
      { id: 'student-dash', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'student-course-learn', label: 'My Courses (LMS)', icon: BookOpen },
      { id: 'student-attendance', label: 'My Attendance', icon: Clock },
      { id: 'student-assignment', label: 'Assignments', icon: FileText },
      { id: 'student-doubt', label: 'My Doubts', icon: HelpCircle },
      { id: 'student-notifications', label: 'Notifications', icon: Bell },
      { id: 'student-profile', label: 'My Profile', icon: User },
    ];
  }

  const content = (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 shrink-0 overflow-hidden">
      {/* Brand Header (Fixed at Top) */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <Logo size="w-9 h-9" alt={`${academyName} Logo`} />
          <div>
            <h1 className="font-extrabold text-xs text-white tracking-tight leading-none">{academyName}</h1>
            <p className="text-[10px] text-blue-400 font-semibold tracking-wide uppercase mt-0.5">{role} Portal</p>
          </div>
        </div>

        {onMobileClose && (
          <button onClick={onMobileClose} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links (Scrolls independently inside fixed sidebar) */}
      <div className="flex-1 min-h-0 py-4 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveScreen(item.id);
                if (onMobileClose) onMobileClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer / Exit (Pushed permanently to Bottom) */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
        <div className="text-[10px] text-slate-400 font-bold mb-3 text-center">Small Steps Big Communication</div>
        <button
          onClick={() => {
            setActiveScreen('public-home');
            if (onMobileClose) onMobileClose();
          }}
          className="w-full flex items-center justify-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit to Public Site</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Full-Height Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {content}
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={onMobileClose}></div>
          <div className="relative z-10 h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
