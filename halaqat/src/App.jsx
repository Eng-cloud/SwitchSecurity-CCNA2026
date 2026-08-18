import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { I18nProvider } from './i18n/index.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { A11yProvider } from './context/A11yContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationsProvider } from './context/NotificationsContext.jsx';

import ErrorBoundary from './components/system/ErrorBoundary.jsx';
import ScrollRestoration from './components/system/ScrollRestoration.jsx';
import RouteAnnouncer from './components/system/RouteAnnouncer.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import {
  RequireAuth,
  RequireRole,
  RequirePermission,
  RedirectIfAuthenticated,
} from './routes/guards.jsx';
import { ACTIONS } from './config/permissions.js';

/* صفحات عامة */
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Verify from './pages/Verify.jsx';
import Register from './pages/Register.jsx';
import Demo from './pages/Demo.jsx';
import NotFound from './pages/NotFound.jsx';

import RoleHomeRedirect from './routes/RoleHomeRedirect.jsx';
import { LoadingState } from './components/ui/States.jsx';

/*
 * صفحات التطبيق تُحمَّل عند الحاجة (Code Splitting) فيبقى الحمل الأولي خفيفًا،
 * وكل دور يحمّل صفحاته فقط.
 */

/* المصحف — مشترك بين الأدوار التي تملك صلاحية القراءة */
const QuranLibrary = lazy(() => import('./pages/quran/QuranLibrary.jsx'));
const QuranReader = lazy(() => import('./pages/quran/QuranReader.jsx'));

/* الطالب */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard.jsx'));
const Review = lazy(() => import('./pages/student/Review.jsx'));
const Recitation = lazy(() => import('./pages/student/Recitation.jsx'));
const Tests = lazy(() => import('./pages/student/Tests.jsx'));
const TestRunner = lazy(() => import('./pages/student/TestRunner.jsx'));
const TestResult = lazy(() => import('./pages/student/TestResult.jsx'));
const Goals = lazy(() => import('./pages/student/Goals.jsx'));
const Progress = lazy(() => import('./pages/student/Progress.jsx'));
const StudentReports = lazy(() => import('./pages/student/Reports.jsx'));

/* المعلم */
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard.jsx'));
const TeacherCircle = lazy(() => import('./pages/teacher/Circle.jsx'));
const TeacherStudents = lazy(() => import('./pages/teacher/Students.jsx'));
const StudentProfile = lazy(() => import('./pages/teacher/StudentProfile.jsx'));
const TeacherSessions = lazy(() => import('./pages/teacher/Sessions.jsx'));
const TeacherReports = lazy(() => import('./pages/teacher/Reports.jsx'));

/* المشرف */
const SupervisorDashboard = lazy(() => import('./pages/supervisor/Dashboard.jsx'));
const SupervisorCircles = lazy(() => import('./pages/supervisor/Circles.jsx'));
const SupervisorCircleDetail = lazy(() => import('./pages/supervisor/CircleDetail.jsx'));
const SupervisorTeachers = lazy(() => import('./pages/supervisor/Teachers.jsx'));
const SupervisorReports = lazy(() => import('./pages/supervisor/Reports.jsx'));

/* الإدارة */
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminCircles = lazy(() => import('./pages/admin/Circles.jsx'));
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'));
const AdminSupervisors = lazy(() => import('./pages/admin/Supervisors.jsx'));
const AdminTeachers = lazy(() => import('./pages/admin/Teachers.jsx'));

/* ولي الأمر */
const ParentDashboard = lazy(() => import('./pages/parent/Dashboard.jsx'));
const ParentChildren = lazy(() => import('./pages/parent/Children.jsx'));
const ParentChildDetail = lazy(() => import('./pages/parent/ChildDetail.jsx'));
const ParentReports = lazy(() => import('./pages/parent/Reports.jsx'));
const ParentRequests = lazy(() => import('./pages/parent/Requests.jsx'));

/* صفحات مشتركة */
const Settings = lazy(() => import('./pages/common/Settings.jsx'));
const Profile = lazy(() => import('./pages/common/Profile.jsx'));
const NotificationsPage = lazy(() => import('./pages/common/Notifications.jsx'));
const SearchPage = lazy(() => import('./pages/common/Search.jsx'));
const EnrollmentRequests = lazy(() => import('./pages/common/EnrollmentRequests.jsx'));

export function AppRoutes() {
  return (
    <>
      <ScrollRestoration />
      <RouteAnnouncer />
      <Routes>
        {/* عامة */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <Login />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/login/verify"
          element={
            <RedirectIfAuthenticated>
              <Verify />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthenticated>
              <Register />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/demo"
          element={
            <RedirectIfAuthenticated>
              <Demo />
            </RedirectIfAuthenticated>
          }
        />
        {/* مسار ولي الأمر المختصر المذكور في المواصفات */}
        <Route path="/parent" element={<Navigate to="/app/parent" replace />} />

        {/* التطبيق */}
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<RoleHomeRedirect />} />

            {/* المصحف: مشترك بين الطالب والمعلم والمشرف وولي الأمر */}
            <Route element={<RequirePermission action={ACTIONS.QURAN_READ} />}>
              <Route path="quran" element={<QuranLibrary />} />
              <Route path="quran/:surahNumber" element={<QuranReader />} />
            </Route>

            {/* الطالب */}
            <Route element={<RequireRole role="student" />}>
              <Route path="student" element={<StudentDashboard />} />
              <Route path="student/quran" element={<Navigate to="/app/quran" replace />} />
              <Route path="student/review" element={<Review />} />
              <Route path="student/recitation" element={<Recitation />} />
              <Route path="student/tests" element={<Tests />} />
              <Route path="student/tests/:testId/run" element={<TestRunner />} />
              <Route path="student/tests/:testId/result" element={<TestResult />} />
              <Route path="student/goals" element={<Goals />} />
              <Route path="student/progress" element={<Progress />} />
              <Route path="student/reports" element={<StudentReports />} />
            </Route>

            {/* المعلم */}
            <Route element={<RequireRole role="teacher" />}>
              <Route path="teacher" element={<TeacherDashboard />} />
              <Route path="teacher/circle" element={<TeacherCircle />} />
              <Route path="teacher/students" element={<TeacherStudents />} />
              <Route path="teacher/students/:studentId" element={<StudentProfile />} />
              <Route path="teacher/sessions" element={<TeacherSessions />} />
              <Route path="teacher/reports" element={<TeacherReports />} />
            </Route>

            {/* المشرف */}
            <Route element={<RequireRole role="supervisor" />}>
              <Route path="supervisor" element={<SupervisorDashboard />} />
              <Route path="supervisor/circles" element={<SupervisorCircles />} />
              <Route path="supervisor/circles/:circleId" element={<SupervisorCircleDetail />} />
              <Route path="supervisor/teachers" element={<SupervisorTeachers />} />
              <Route path="supervisor/manage-teachers" element={<AdminTeachers />} />
              <Route path="supervisor/requests" element={<EnrollmentRequests />} />
              <Route path="supervisor/students/:studentId" element={<StudentProfile />} />
              <Route path="supervisor/reports" element={<SupervisorReports />} />
            </Route>

            {/* الإدارة */}
            <Route element={<RequireRole role="admin" />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/supervisors" element={<AdminSupervisors />} />
              <Route path="admin/teachers" element={<AdminTeachers />} />
              <Route path="admin/circles" element={<AdminCircles />} />
              <Route path="admin/requests" element={<EnrollmentRequests />} />
              <Route path="admin/students/:studentId" element={<StudentProfile />} />
              <Route path="admin/reports" element={<AdminReports />} />
              <Route path="admin/analytics" element={<AdminAnalytics />} />
              <Route path="admin/settings" element={<AdminSettings />} />
            </Route>

            {/* ولي الأمر */}
            <Route element={<RequireRole role="parent" />}>
              <Route path="parent" element={<ParentDashboard />} />
              <Route path="parent/children" element={<ParentChildren />} />
              <Route path="parent/children/:studentId" element={<ParentChildDetail />} />
              <Route path="parent/requests" element={<ParentRequests />} />
              <Route path="parent/reports" element={<ParentReports />} />
            </Route>

            {/* مشتركة */}
            <Route path="settings" element={<Settings />} />
            <Route path="settings/:section" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="search" element={<SearchPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

/** مزوّدات التطبيق — مرتبة بحيث يعتمد كل مزود على ما فوقه فقط. */
export function AppProviders({ children }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <A11yProvider>
          <ToastProvider>
            <AuthProvider>
              <NotificationsProvider>{children}</NotificationsProvider>
            </AuthProvider>
          </ToastProvider>
        </A11yProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

/*
 * عند النشر كملف واحد (بلا خادم يعيد كتابة المسارات) نستخدم التوجيه بالـhash
 * حتى تعمل الروابط العميقة وزر الرجوع كما هي.
 */
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <Router>
          <AppRoutes />
        </Router>
      </AppProviders>
    </ErrorBoundary>
  );
}
