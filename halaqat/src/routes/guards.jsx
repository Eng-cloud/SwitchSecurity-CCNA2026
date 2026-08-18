import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/navigation.js';
import { can } from '../config/permissions.js';
import { LoadingState } from '../components/ui/States.jsx';

/**
 * حماية المسارات: بدون جلسة → صفحة الدخول.
 * تمنع أيضًا العودة إلى الصفحات المحمية عبر زر Back بعد تسجيل الخروج،
 * لأن الجلسة تُقرأ من التخزين في كل تنقل.
 */
export function RequireAuth() {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingState />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** مسارات خاصة بدور معيّن — تحويل هادئ إلى لوحة الدور الحالي. */
export function RequireRole({ role: allowed }) {
  const { role } = useAuth();
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];

  if (!role) return <Navigate to="/login" replace />;
  if (!allowedList.includes(role)) {
    return <Navigate to={ROLE_HOME[role] ?? '/app'} replace />;
  }
  return <Outlet />;
}

/** صفحات الدخول لا تُعرض لمن لديه جلسة فعّالة. */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, role, ready } = useAuth();
  if (ready && isAuthenticated) {
    return <Navigate to={ROLE_HOME[role] ?? '/app'} replace />;
  }
  return children;
}

/** مسار محكوم بصلاحية لا بدور — مثل المصحف المتاح لأربعة أدوار. */
export function RequirePermission({ action }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/login" replace />;
  if (!can(role, action)) return <Navigate to={ROLE_HOME[role] ?? '/app'} replace />;
  return <Outlet />;
}
