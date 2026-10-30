import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { WebsiteSettingsProvider, useWebsiteSettings } from './context/WebsiteSettingsContext';
import PublicNavbar from './components/layout/PublicNavbar';
import DashboardSidebar from './components/layout/DashboardSidebar';
import DashboardHeader from './components/layout/DashboardHeader';
import ErrorBoundary from './components/common/ErrorBoundary';

import HomePage from './components/public/HomePage';
import CoursePage from './components/public/CoursePage';
import CompetitionPage from './components/public/CompetitionPage';
import ContactPage from './components/public/ContactPage';
import EnquireModal from './components/public/EnquireModal';
import LoginModal from './components/public/LoginModal';
import PolicyModal from './components/common/PolicyModal';
import { getWebsiteSettings } from './api/websiteSettingsApi';
import { getMyPortals } from './api/competitionApi';

// Code-splitting via React.lazy for portal screens
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const ManageCoursesPage = lazy(() => import('./components/admin/ManageCoursesPage'));
const AdminBatchManagementPage = lazy(() => import('./components/admin/AdminBatchManagementPage'));
const AddCoursePage = lazy(() => import('./components/admin/AddCoursePage'));
const EditCoursePage = lazy(() => import('./components/admin/EditCoursePage'));
const CourseContentPage = lazy(() => import('./components/admin/CourseContentPage'));
const ManageStudentsPage = lazy(() => import('./components/admin/ManageStudentsPage'));
const ManageTrainersPage = lazy(() => import('./components/admin/ManageTrainersPage'));
const AdminAttendancePage = lazy(() => import('./components/admin/AttendancePage'));
const AdminSchedulePage = lazy(() => import('./components/admin/AdminSchedulePage'));
const AdminTrainerSessionsPage = lazy(() => import('./components/admin/AdminTrainerSessionsPage'));
const AdminFeesPage = lazy(() => import('./components/admin/AdminFeesPage'));
const AdminExpensesPage = lazy(() => import('./components/admin/AdminExpensesPage'));
const AdminSalaryPage = lazy(() => import('./components/admin/AdminSalaryPage'));
const AdminDailyReportPage = lazy(() => import('./components/admin/AdminDailyReportPage'));
const AdminCompetitionPage = lazy(() => import('./components/admin/AdminCompetitionPage'));
const AdminCompetitionManagementPage = lazy(() => import('./components/admin/AdminCompetitionManagementPage'));
const AdminCompetitionRegistrationsPage = lazy(() => import('./components/admin/AdminCompetitionRegistrationsPage'));
const AdminCompetitionEvaluationsPage = lazy(() => import('./components/admin/AdminCompetitionEvaluationsPage'));
const AdminAssignmentsPage = lazy(() => import('./components/admin/AdminAssignmentsPage'));
const AdminTrainerAssignmentsPage = lazy(() => import('./components/admin/AdminTrainerAssignmentsPage'));
const AdminDoubtsPage = lazy(() => import('./components/admin/AdminDoubtsPage'));
const AdminEnquiryPage = lazy(() => import('./components/admin/AdminEnquiryPage'));
const AdminReportsPage = lazy(() => import('./components/admin/AdminReportsPage'));
const AdminNotificationsPage = lazy(() => import('./components/admin/AdminNotificationsPage'));
const AdminSettingsPage = lazy(() => import('./components/admin/AdminSettingsPage'));

const TrainerDashboard = lazy(() => import('./components/trainer/TrainerDashboard'));
const TrainerCoursesPage = lazy(() => import('./components/trainer/TrainerCoursesPage'));
const TrainerCompetitionsPage = lazy(() => import('./components/trainer/TrainerCompetitionsPage'));
const TrainerStudentsPage = lazy(() => import('./components/trainer/TrainerStudentsPage'));
const TrainerSchedulePage = lazy(() => import('./components/trainer/TrainerSchedulePage'));
const TrainerSessionsPage = lazy(() => import('./components/trainer/TrainerSessionsPage'));
const TrainerAssignmentsPage = lazy(() => import('./components/trainer/TrainerAssignmentsPage'));
const TrainerSubmissionsPage = lazy(() => import('./components/trainer/TrainerSubmissionsPage'));
const TrainerDoubtsPage = lazy(() => import('./components/trainer/TrainerDoubtsPage'));
const TrainerAttendancePage = lazy(() => import('./components/trainer/TrainerAttendancePage'));
const TrainerNotificationsPage = lazy(() => import('./components/trainer/TrainerNotificationsPage'));
const TrainerProfilePage = lazy(() => import('./components/trainer/TrainerProfilePage'));

const StudentDashboard = lazy(() => import('./components/student/StudentDashboard'));
const CourseLearningPage = lazy(() => import('./components/student/CourseLearningPage'));
const StudentAttendancePage = lazy(() => import('./components/student/AttendancePage'));
const JoinSessionPage = lazy(() => import('./components/student/JoinSessionPage'));
const AssignmentPage = lazy(() => import('./components/student/AssignmentPage'));
const DoubtPage = lazy(() => import('./components/student/DoubtPage'));
const StudentNotificationsPage = lazy(() => import('./components/student/StudentNotificationsPage'));
const StudentProfilePage = lazy(() => import('./components/student/StudentProfilePage'));

// Competition Portal screens
const PortalSelectPage = lazy(() => import('./components/portal/PortalSelectPage'));
const CompetitionPortalLayout = lazy(() => import('./components/competition/CompetitionPortalLayout'));
const StudentCompetitionPortalPage = lazy(() => import('./components/competition/StudentCompetitionPortalPage'));
const CompetitionSyllabusPage = lazy(() => import('./components/competition/CompetitionSyllabusPage'));
const CompetitionStudyMaterialsPage = lazy(() => import('./components/competition/CompetitionStudyMaterialsPage'));
const CompetitionTestSeriesPage = lazy(() => import('./components/competition/CompetitionTestSeriesPage'));
const CompetitionMockTestsPage = lazy(() => import('./components/competition/CompetitionMockTestsPage'));
const CompetitionFinalAssessmentPage = lazy(() => import('./components/competition/CompetitionFinalAssessmentPage'));
const TrainerCompetitionEvaluationPage = lazy(() => import('./components/competition/TrainerCompetitionEvaluationPage'));
const CompetitionLeaderboardPage = lazy(() => import('./components/competition/CompetitionLeaderboardPage'));
const CompetitionPlaceholderPage = lazy(() => import('./components/competition/CompetitionPlaceholderPage'));


function PortalLoadingFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <span className="text-sm font-medium text-slate-500">Loading module...</span>
      </div>
    </div>
  );
}

function getActiveScreenFromPath(path) {
  if (path === '/' || path === '/home') return 'public-home';
  if (path === '/courses') return 'public-course';
  if (path === '/competitions') return 'public-competition';
  if (path === '/contact') return 'public-contact';

  if (path === '/admin' || path === '/admin/') return 'admin-dash';
  if (path === '/admin/courses') return 'admin-manage-courses';
  if (path === '/admin/courses/new') return 'admin-add-course';
  if (path.includes('/admin/courses/') && path.includes('/edit')) return 'admin-edit-course';
  if (path.includes('/admin/courses/') && path.includes('/content')) return 'admin-course-content';
  if (path === '/admin/batches') return 'admin-batch-management';
  if (path === '/admin/students') return 'admin-manage-students';
  if (path === '/admin/trainers') return 'admin-manage-trainers';
  if (path === '/admin/attendance') return 'admin-attendance';
  if (path === '/admin/schedules') return 'admin-schedule';
  if (path === '/admin/trainer-sessions') return 'admin-trainer-sessions';
  if (path === '/admin/assignments') return 'admin-assignments';
  if (path === '/admin/trainer-assignments') return 'admin-trainer-assignments';
  if (path === '/admin/doubts') return 'admin-doubts';
  if (path === '/admin/enquiries') return 'admin-enquiries';
  if (path === '/admin/fees') return 'admin-fees';
  if (path === '/admin/expenses') return 'admin-expenses';
  if (path === '/admin/salary') return 'admin-salary';
  if (path === '/admin/daily-reports') return 'admin-daily-reports';
  if (path === '/admin/competitions') return 'admin-competition';
  if (path === '/admin/competition-management') return 'admin-competition-management';
  if (path === '/admin/competitions/registrations') return 'admin-competition-registrations';
  if (path === '/admin/competition-evaluations' || path === '/admin/competitions/evaluations') return 'admin-competition-evaluations';
  if (path === '/admin/reports') return 'admin-reports';
  if (path === '/admin/notifications') return 'admin-notifications';
  if (path === '/admin/settings') return 'admin-settings';

  if (path === '/trainer' || path === '/trainer/') return 'trainer-dash';
  if (path === '/trainer/courses') return 'trainer-courses';
  if (path === '/trainer/competitions') return 'trainer-competitions';
  if (path === '/trainer/students') return 'trainer-students';
  if (path === '/trainer/schedules' || path === '/trainer/schedule') return 'trainer-schedule';
  if (path === '/trainer/sessions' || path === '/trainer/session') return 'trainer-sessions';
  if (path === '/trainer/assignments') return 'trainer-assignments';
  if (path === '/trainer/submissions') return 'trainer-submissions';
  if (path === '/trainer/doubts') return 'trainer-doubts';
  if (path === '/trainer/attendance') return 'trainer-attendance';
  if (path === '/trainer/notifications') return 'trainer-notifications';
  if (path === '/trainer/profile') return 'trainer-profile';

  if (path === '/student' || path === '/student/') return 'student-dash';
  if (path === '/student/courses') return 'student-course-learn';
  if (path === '/student/attendance') return 'student-attendance';
  if (path === '/student/join') return 'student-join';
  if (path === '/student/assignments') return 'student-assignment';
  if (path === '/student/doubts') return 'student-doubt';
  if (path === '/student/notifications') return 'student-notifications';
  if (path === '/student/profile') return 'student-profile';

  return 'public-home';
}

function screenToPath(screen, params = {}) {
  switch (screen) {
    case 'public-home': return '/';
    case 'public-course': return '/courses';
    case 'public-competition': return '/competitions';
    case 'public-contact': return '/contact';

    // Admin
    case 'admin-dash': return '/admin';
    case 'admin-manage-courses': return '/admin/courses';
    case 'admin-add-course': return '/admin/courses/new';
    case 'admin-edit-course': return params.courseId ? `/admin/courses/${params.courseId}/edit` : '/admin/courses';
    case 'admin-course-content': return params.courseId ? `/admin/courses/${params.courseId}/content` : '/admin/courses';
    case 'admin-batch-management': return '/admin/batches';
    case 'admin-manage-students': return '/admin/students';
    case 'admin-manage-trainers': return '/admin/trainers';
    case 'admin-attendance': return '/admin/attendance';
    case 'admin-schedule': return '/admin/schedules';
    case 'admin-trainer-sessions': return '/admin/trainer-sessions';
    case 'admin-assignments': return '/admin/assignments';
    case 'admin-trainer-assignments': return '/admin/trainer-assignments';
    case 'admin-doubts': return '/admin/doubts';
    case 'admin-enquiries': return '/admin/enquiries';
    case 'admin-fees': return '/admin/fees';
    case 'admin-expenses': return '/admin/expenses';
    case 'admin-salary': return '/admin/salary';
    case 'admin-daily-reports': return '/admin/daily-reports';
    case 'admin-competition': return '/admin/competitions';
    case 'admin-competition-management': return '/admin/competition-management';
    case 'admin-competition-registrations': return '/admin/competitions/registrations';
    case 'admin-competition-evaluations': return '/admin/competition-evaluations';
    case 'admin-reports': return '/admin/reports';
    case 'admin-notifications': return '/admin/notifications';
    case 'admin-settings': return '/admin/settings';

    // Trainer
    case 'trainer-dash': return '/trainer';
    case 'trainer-courses': return '/trainer/courses';
    case 'trainer-competitions': return '/trainer/competitions';
    case 'trainer-students': return '/trainer/students';
    case 'trainer-schedule': return '/trainer/schedules';
    case 'trainer-sessions': return '/trainer/sessions';
    case 'trainer-assignments': return '/trainer/assignments';
    case 'trainer-submissions': return '/trainer/submissions';
    case 'trainer-doubts': return '/trainer/doubts';
    case 'trainer-attendance': return '/trainer/attendance';
    case 'trainer-notifications': return '/trainer/notifications';
    case 'trainer-profile': return '/trainer/profile';

    // Student
    case 'student-dash': return '/student';
    case 'student-course-learn': return '/student/courses';
    case 'student-attendance': return '/student/attendance';
    case 'student-join': return '/student/join';
    case 'student-assignment': return '/student/assignments';
    case 'student-doubt': return '/student/doubts';
    case 'student-notifications': return '/student/notifications';
    case 'student-profile': return '/student/profile';

    default:
      if (typeof screen === 'string' && screen.startsWith('/')) return screen;
      return '/';
  }
}

// Protected route component that checks auth, role, and portal permissions
function ProtectedRoute({ allowedRoles, portalType, children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [portalAccess, setPortalAccess] = useState(null);
  const isPortalCheckRoute = Boolean(portalType || location.pathname === '/portal-select');
  const [checkingPortals, setCheckingPortals] = useState(Boolean(isPortalCheckRoute && user));

  useEffect(() => {
    if (!isPortalCheckRoute || !user) {
      setCheckingPortals(false);
      return;
    }
    let isMounted = true;
    getMyPortals().then(res => {
      if (isMounted) {
        setPortalAccess(res?.data || { learning: true, competition: false });
        setCheckingPortals(false);
      }
    }).catch(() => {
      if (isMounted) setCheckingPortals(false);
    });
    return () => { isMounted = false; };
  }, [isPortalCheckRoute, user]);

  if (loading || checkingPortals) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Loading Zoro English Academy...</p>
      </div>
    );
  }

  // Unauthenticated users can NEVER view dashboard screens
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const currentRole = (user.role || role || '').toUpperCase();
  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    } else if (currentRole === 'TRAINER') {
      return <Navigate to="/trainer" replace />;
    } else {
      return <Navigate to="/student" replace />;
    }
  }

  const hasLearning = Boolean(portalAccess?.learning ?? user?.hasCourseEnrollment);
  const hasCompetition = Boolean(portalAccess?.competition ?? user?.hasCompetitionRegistration);

  // Portal selection page: only for students registered in BOTH
  if (location.pathname === '/portal-select') {
    if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    if (currentRole === 'TRAINER') {
      return <Navigate to="/trainer" replace />;
    }
    if (hasLearning && !hasCompetition) {
      return <Navigate to="/student" replace />;
    }
    if (!hasLearning && hasCompetition) {
      return <Navigate to="/competition" replace />;
    }
  }

  // Competition portal: only for registered students (admins & trainers stay in their own portals)
  if (portalType === 'competition') {
    if (currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    if (currentRole === 'TRAINER') {
      return <Navigate to="/trainer" replace />;
    }
    if (currentRole === 'STUDENT' && !hasCompetition) {
      return <Navigate to="/student" replace />;
    }
  }

  // Learning portal: competition-only students cannot enter
  if (portalType === 'learning' && currentRole === 'STUDENT' && !hasLearning && hasCompetition) {
    return <Navigate to="/competition" replace />;
  }

  return children;
}


const PRIVACY_POLICY_TEXT = `At Zoro English Academy, we are dedicated to protecting your privacy and personal information. We collect necessary details such as your name, contact information, and academic background solely for admission, training, and competition coordination purposes. We do not sell or share your data with external third parties without your explicit consent, except as required by law. All data is securely stored and processed in compliance with applicable data protection regulations. By using our website, programs, and competition portals, you agree to the collection and handling of your information as outlined in this policy. For any privacy queries or data removal requests, please contact our support team.`;

const TERMS_OF_SERVICE_TEXT = `Welcome to Zoro English Academy. By registering for our courses, competitions, or using our online portals, you agree to adhere to our standard terms and conditions. All course materials, syllabi, guidance videos, and assessment content remain the exclusive intellectual property of Zoro English Academy and may not be reproduced, shared, or distributed without written permission. Fees paid for courses and competitions are non-refundable once registration is confirmed, except where explicitly noted. Participants are expected to maintain professional conduct, academic integrity, and respect toward trainers and peers during all sessions and assessments. We reserve the right to modify course offerings, schedules, and policies when necessary to maintain our high academic standards.`;

// Public website layout
function PublicLayout({ onOpenLogin, onOpenEnquire }) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeScreen = getActiveScreenFromPath(location.pathname);
  const { settings: siteSettings, academyName, contactEmail, contactPhone, address } = useWebsiteSettings();
  const [policyModal, setPolicyModal] = useState({ isOpen: false, title: "", content: "", type: "privacy" });

  const handleSetActiveScreen = (screen) => {
    if (screen === 'public-login') {
      onOpenLogin();
    } else {
      navigate(screenToPath(screen));
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-900">
      <PublicNavbar 
        activeScreen={activeScreen} 
        setActiveScreen={handleSetActiveScreen}
        onOpenLogin={onOpenLogin}
        onOpenEnquire={onOpenEnquire}
        siteSettings={siteSettings}
      />
      <main className="flex-1">
        <div key={location.pathname} className="page-transition">
          <Outlet context={{ onOpenLogin, onOpenEnquire, setActiveScreen: handleSetActiveScreen }} />
        </div>
      </main>
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center space-x-3 text-center sm:text-left gap-2 sm:gap-0">
            <img src="/assets/logo.png" alt={`${academyName} Logo`} className="h-7 w-auto object-contain" />
            <div>
              <span className="font-extrabold text-white text-sm block sm:inline">{academyName}</span>
              <span className="block sm:inline sm:ml-2">Â© 2026 {academyName}. All rights reserved.</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400 font-medium">
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors">
                {contactEmail}
              </a>
            )}
            {contactPhone && (
              <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="hover:text-white transition-colors">
                {contactPhone}
              </a>
            )}
            {address && (
              <span className="hidden lg:inline text-slate-500">
                {address}
              </span>
            )}
          </div>
          <div className="flex space-x-6 text-slate-400 font-semibold">
            <button
              type="button"
              onClick={() => setPolicyModal({
                isOpen: true,
                title: 'Privacy Policy',
                content: PRIVACY_POLICY_TEXT,
                type: 'privacy'
              })}
              className="hover:text-white cursor-pointer font-semibold transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setPolicyModal({
                isOpen: true,
                title: 'Terms of Service',
                content: TERMS_OF_SERVICE_TEXT,
                type: 'terms'
              })}
              className="hover:text-white cursor-pointer font-semibold transition-colors"
            >
              Terms of Service
            </button>
            <button 
              onClick={() => navigate('/contact')}
              className="hover:text-white cursor-pointer"
            >
              Contact Us
            </button>
          </div>
        </div>
      </footer>
      <PolicyModal
        isOpen={policyModal.isOpen}
        onClose={() => setPolicyModal(prev => ({ ...prev, isOpen: false }))}
        title={policyModal.title}
        content={policyModal.content}
        type={policyModal.type}
      />
    </div>
  );
}

// Authenticated portal dashboard layout (Strictly authenticated user, no fake fallbacks)
function DashboardLayout({ expectedRole }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const selectedCourseIdRef = useRef('');
  const selectedCompIdRef = useRef('');

  const activeScreen = getActiveScreenFromPath(location.pathname);
  const currentRole = (user?.role || expectedRole || '').toUpperCase();

  const handleSetActiveScreen = (screen) => {
    if (screen === 'admin-edit-course') {
      navigate(selectedCourseIdRef.current ? `/admin/courses/${selectedCourseIdRef.current}/edit` : '/admin/courses');
    } else if (screen === 'admin-course-content') {
      navigate(selectedCourseIdRef.current ? `/admin/courses/${selectedCourseIdRef.current}/content` : '/admin/courses');
    } else {
      navigate(screenToPath(screen));
    }
  };

  const setSelectedCourseIdForEdit = (id) => {
    selectedCourseIdRef.current = id;
  };


  return (
    <div className="h-screen w-full flex overflow-hidden bg-slate-50 font-sans antialiased text-slate-900">
      <DashboardSidebar 
        role={currentRole} 
        activeScreen={activeScreen} 
        setActiveScreen={handleSetActiveScreen} 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <DashboardHeader 
          user={user} 
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
          setActiveScreen={handleSetActiveScreen}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Suspense fallback={<PortalLoadingFallback />}>
            <ErrorBoundary>
              <div key={location.pathname} className="page-transition">
                <Outlet context={{ 
                  setActiveScreen: handleSetActiveScreen, 
                  setSelectedCourseIdForEdit 
                }} />
              </div>
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// Wrapper components for parameterized route views
function EditCourseWrapper() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  return <EditCoursePage courseId={courseId} setActiveScreen={(s) => navigate(screenToPath(s))} />;
}

function CourseContentWrapper() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  return <CourseContentPage courseId={courseId} setActiveScreen={(s) => navigate(screenToPath(s))} />;
}


function PublicHomeWrapper() {
  const navigate = useNavigate();
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  return (
    <>
      <HomePage 
        setActiveScreen={(s) => navigate(screenToPath(s))} 
        onOpenEnquire={() => setIsEnquireOpen(true)} 
      />
      <EnquireModal isOpen={isEnquireOpen} onClose={() => setIsEnquireOpen(false)} />
    </>
  );
}

function PublicCourseWrapper() {
  const navigate = useNavigate();
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  return (
    <>
      <CoursePage 
        onOpenEnquire={() => setIsEnquireOpen(true)} 
        setActiveScreen={(s) => navigate(screenToPath(s))} 
      />
      <EnquireModal isOpen={isEnquireOpen} onClose={() => setIsEnquireOpen(false)} />
    </>
  );
}

function PublicCompetitionWrapper() {
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  return (
    <>
      <CompetitionPage onOpenEnquire={() => setIsEnquireOpen(true)} />
      <EnquireModal isOpen={isEnquireOpen} onClose={() => setIsEnquireOpen(false)} />
    </>
  );
}

function PublicContactWrapper() {
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  return (
    <>
      <ContactPage onOpenEnquire={() => setIsEnquireOpen(true)} />
      <EnquireModal isOpen={isEnquireOpen} onClose={() => setIsEnquireOpen(false)} />
    </>
  );
}

function AppRoutes() {
  const { loading, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();
  const [isEnquireOpen, setIsEnquireOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    if (authNotice) {
      setIsLoginOpen(true);
    }
  }, [authNotice]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Loading Zoro English Academy...</p>
      </div>
    );
  }

  const handleLoginSuccess = async (loggedUser) => {
    setIsLoginOpen(false);
    const roleUpper = (loggedUser?.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      navigate('/admin');
      return;
    }
    if (roleUpper === 'TRAINER') {
      navigate('/trainer');
      return;
    }

    try {
      const pRes = await getMyPortals();
      const p = pRes?.data;
      const hasLearning = Boolean(p?.learning ?? loggedUser?.hasCourseEnrollment);
      const hasCompetition = Boolean(p?.competition ?? loggedUser?.hasCompetitionRegistration);

      if (hasLearning && hasCompetition) {
        navigate('/portal-select');
        return;
      }
      if (!hasLearning && hasCompetition) {
        navigate('/competition');
        return;
      }
      navigate('/student');
      return;
    } catch (e) {
      if (loggedUser?.hasCourseEnrollment && loggedUser?.hasCompetitionRegistration) {
        navigate('/portal-select');
      } else if (!loggedUser?.hasCourseEnrollment && loggedUser?.hasCompetitionRegistration) {
        navigate('/competition');
      } else {
        navigate('/student');
      }
    }
  };

  return (
    <>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route element={<PublicLayout onOpenLogin={() => setIsLoginOpen(true)} onOpenEnquire={() => setIsEnquireOpen(true)} />}>
          <Route path="/" element={<PublicHomeWrapper />} />
          <Route path="/courses" element={<PublicCourseWrapper />} />
          <Route path="/competitions" element={<PublicCompetitionWrapper />} />
          <Route path="/contact" element={<PublicContactWrapper />} />
        </Route>

        {/* PORTAL SELECT ROUTE */}
        <Route path="/portal-select" element={
          <ProtectedRoute>
            <Suspense fallback={<PortalLoadingFallback />}>
              <PortalSelectPage />
            </Suspense>
          </ProtectedRoute>
        } />

        {/* ADMIN ROUTES */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
            <DashboardLayout expectedRole="ADMIN" />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="courses" element={<ManageCoursesPage setActiveScreen={(s) => navigate(screenToPath(s))} setSelectedCourseIdForEdit={(id) => navigate(`/admin/courses/${id}/edit`)} />} />
          <Route path="courses/new" element={<AddCoursePage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="courses/:courseId/edit" element={<EditCourseWrapper />} />
          <Route path="courses/:courseId/content" element={<CourseContentWrapper />} />
          <Route path="batches" element={<AdminBatchManagementPage />} />
          <Route path="students" element={<ManageStudentsPage />} />
          <Route path="trainers" element={<ManageTrainersPage />} />
          <Route path="attendance" element={<AdminAttendancePage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="schedules" element={<AdminSchedulePage />} />
          <Route path="trainer-sessions" element={<AdminTrainerSessionsPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="assignments" element={<AdminAssignmentsPage />} />
          <Route path="trainer-assignments" element={<AdminTrainerAssignmentsPage />} />
          <Route path="doubts" element={<AdminDoubtsPage />} />
          <Route path="enquiries" element={<AdminEnquiryPage />} />
          <Route path="fees" element={<AdminFeesPage />} />
          <Route path="expenses" element={<AdminExpensesPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="salary" element={<AdminSalaryPage />} />
          <Route path="daily-reports" element={<AdminDailyReportPage />} />
          <Route path="competitions" element={<AdminCompetitionPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="competition-management" element={<AdminCompetitionManagementPage />} />
          <Route path="competitions/registrations" element={<AdminCompetitionRegistrationsPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="competition-evaluations" element={<AdminCompetitionEvaluationsPage />} />
          <Route path="competitions/evaluations" element={<AdminCompetitionEvaluationsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* TRAINER ROUTES */}
        <Route path="/trainer" element={
          <ProtectedRoute allowedRoles={['TRAINER']}>
            <DashboardLayout expectedRole="TRAINER" />
          </ProtectedRoute>
        }>
          <Route index element={<TrainerDashboard setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="courses" element={<TrainerCoursesPage />} />
          <Route path="competitions" element={<TrainerCompetitionsPage />} />
          <Route path="students" element={<TrainerStudentsPage />} />
          <Route path="schedules" element={<TrainerSchedulePage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="schedule" element={<TrainerSchedulePage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="sessions" element={<TrainerSessionsPage />} />
          <Route path="session" element={<TrainerSessionsPage />} />
          <Route path="assignments" element={<TrainerAssignmentsPage />} />
          <Route path="submissions" element={<TrainerSubmissionsPage />} />
          <Route path="doubts" element={<TrainerDoubtsPage />} />
          <Route path="attendance" element={<TrainerAttendancePage />} />
          <Route path="notifications" element={<TrainerNotificationsPage />} />
          <Route path="profile" element={<TrainerProfilePage />} />
          <Route path="*" element={<Navigate to="/trainer" replace />} />
        </Route>

        {/* STUDENT ROUTES (Learning Portal guarded) */}
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['STUDENT']} portalType="learning">
            <DashboardLayout expectedRole="STUDENT" />
          </ProtectedRoute>
        }>
          <Route index element={<StudentDashboard setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="courses" element={<CourseLearningPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="attendance" element={<StudentAttendancePage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="join" element={<JoinSessionPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="assignments" element={<AssignmentPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="doubts" element={<DoubtPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="notifications" element={<StudentNotificationsPage setActiveScreen={(s) => navigate(screenToPath(s))} />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Route>

        {/* COMPETITION PORTAL ROUTES */}
        <Route path="/competition" element={
          <ProtectedRoute portalType="competition">
            <Suspense fallback={<PortalLoadingFallback />}>
              <CompetitionPortalLayout />
            </Suspense>
          </ProtectedRoute>
        }>
          <Route index element={<StudentCompetitionPortalPage />} />
          <Route path="portal" element={<StudentCompetitionPortalPage />} />
          <Route path="syllabus" element={<CompetitionSyllabusPage />} />
          <Route path="materials" element={<CompetitionStudyMaterialsPage />} />
          <Route path="study-materials" element={<Navigate to="/competition/materials" replace />} />
          <Route path="test-series" element={<CompetitionTestSeriesPage />} />

          <Route path="mock-tests" element={<CompetitionMockTestsPage />} />
          <Route path="final-assessment" element={<CompetitionFinalAssessmentPage />} />
          <Route path="evaluations" element={<TrainerCompetitionEvaluationPage />} />
          <Route path="leaderboard" element={<CompetitionLeaderboardPage />} />
          <Route path="*" element={<Navigate to="/competition" replace />} />
        </Route>

        {/* CATCH-ALL REDIRECT TO HOME */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Modals */}
      <EnquireModal isOpen={isEnquireOpen} onClose={() => setIsEnquireOpen(false)} />
      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => {
          setIsLoginOpen(false);
          clearAuthNotice();
        }} 
        onLoginSuccess={handleLoginSuccess}
        onOpenEnquire={() => {
          setIsLoginOpen(false);
          setIsEnquireOpen(true);
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DialogProvider>
          <WebsiteSettingsProvider>
            <AppRoutes />
          </WebsiteSettingsProvider>
        </DialogProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
